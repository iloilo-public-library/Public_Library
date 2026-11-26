import { gzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDropboxConfigured, uploadToDropbox } from "@/lib/storage/dropbox";
import { toManilaDateKey } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const BACKUP_TABLES = [
  "users",
  "books",
  "book_inventory",
  "book_copies",
  "library_cards",
  "library_card_books",
  "book_returns",
  "book_return_items",
  "account_requests",
  "announcements",
  "events",
  "event_categories",
  "event_exceptions",
  "event_reminders",
  "event_reminder_log",
  "system_settings",
  "user_favorites",
  "user_search_history",
  "user_appearance",
  "staff_appearance",
  "notification_reads",
  "login_sessions",
  "error_logs",
] as const;

const TABLE_ROW_CAP = 50000;

export interface BackupRunOptions {
  backupType: "manual" | "scheduled";
  scope?: string;
}

export interface BackupRunResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  log: Record<string, unknown> | null;
  tableCounts: Record<string, number>;
  error?: string;
}

/**
 * Determines whether a scheduled backup is due for the configured frequency
 * so repeated cron invocations within the same window are idempotent.
 */
export function isScheduledBackupDue(
  frequency: string,
  lastSuccessIso: string | null | undefined,
  now: Date = new Date()
): boolean {
  const freq = frequency.trim().toLowerCase();
  if (freq === "off") return false;
  if (!lastSuccessIso) return true;

  const lastMs = Date.parse(lastSuccessIso);
  if (!Number.isFinite(lastMs)) return true;

  const elapsedMs = now.getTime() - lastMs;
  if (elapsedMs < 0) return false;

  if (freq === "hourly") {
    return elapsedMs >= 55 * 60 * 1000;
  }
  if (freq === "daily") {
    return toManilaDateKey(now) !== toManilaDateKey(lastMs);
  }
  if (freq === "weekly") {
    return elapsedMs >= 6.5 * 24 * 60 * 60 * 1000;
  }
  if (freq === "monthly") {
    return elapsedMs >= 27 * 24 * 60 * 60 * 1000;
  }
  return true;
}

function sanitizeBackupLogOutput(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return null;
  // Never expose Dropbox tokens or raw secrets
  return {
    id: row.id,
    backup_type: row.backup_type,
    scope: row.scope,
    file_name: row.file_name,
    file_size_bytes: row.file_size_bytes,
    status: row.status,
    error_message: row.error_message ?? "",
    created_at: row.created_at,
  };
}

export async function runSupabaseBackup(
  supabase: SupabaseClient,
  options: BackupRunOptions
): Promise<BackupRunResult> {
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const fileName = `supabase_backup_${stamp}.json.gz`;
  const scope = options.scope?.trim() || "Supabase Full Database Snapshot";
  const dropboxBase = (
    process.env.DROPBOX_FOLDER?.trim() || "/Iloilo_Public_Library_Backups"
  ).replace(/\/+$/, "");
  const dropboxPath = `${dropboxBase}/${fileName}`;

  const tableCounts: Record<string, number> = {};
  const tablesData: Record<string, unknown[]> = {};

  try {
    for (const table of BACKUP_TABLES) {
      const { data, error } = await supabase.from(table).select("*").limit(TABLE_ROW_CAP);
      if (error) {
        logger.warn("Backup table skipped due to query error", {
          table,
          error: error.message,
        });
        tablesData[table] = [];
        tableCounts[table] = 0;
      } else {
        const rows = data ?? [];
        tablesData[table] = rows;
        tableCounts[table] = rows.length;
      }
    }

    const snapshot = {
      version: 1,
      source: "supabase",
      generated_at: new Date().toISOString(),
      backup_type: options.backupType,
      scope,
      table_counts: tableCounts,
      tables: tablesData,
    };

    const rawJson = JSON.stringify(snapshot);
    const compressed = gzipSync(Buffer.from(rawJson, "utf8"));
    const byteSize = compressed.byteLength;

    let status: "success" | "failed" = "success";
    let errorMessage = "";

    if (isDropboxConfigured()) {
      try {
        await uploadToDropbox(dropboxPath, new Uint8Array(compressed));
      } catch (uploadErr) {
        status = "failed";
        errorMessage =
          uploadErr instanceof Error ? uploadErr.message : "Dropbox backup upload failed.";
        logger.error("Supabase backup upload to Dropbox failed", {
          fileName,
          error: errorMessage,
        });
      }
    } else {
      status = "failed";
      errorMessage = "Dropbox storage credentials are not configured.";
    }

    const dbBackupType = options.backupType === "manual" ? "manual" : "auto";
    const { data: logRow, error: logErr } = await supabase
      .from("backup_logs")
      .insert({
        backup_type: dbBackupType,
        scope,
        file_name: fileName,
        file_size_bytes: byteSize,
        dropbox_path: dropboxPath,
        status,
        error_message: errorMessage,
      })
      .select("*")
      .single();

    if (logErr) {
      logger.error("Failed to insert backup_logs row", { error: logErr.message });
    }

    return {
      ok: status === "success",
      log: sanitizeBackupLogOutput((logRow as Record<string, unknown> | null) ?? null),
      tableCounts,
      ...(errorMessage ? { error: errorMessage } : {}),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backup execution failed.";
    logger.error("Supabase backup job failed", { error: message });

    const dbBackupType = options.backupType === "manual" ? "manual" : "auto";
    const { data: logRow } = await supabase
      .from("backup_logs")
      .insert({
        backup_type: dbBackupType,
        scope,
        file_name: fileName,
        file_size_bytes: 0,
        dropbox_path: dropboxPath,
        status: "failed",
        error_message: message,
      })
      .select("*")
      .single();

    return {
      ok: false,
      log: sanitizeBackupLogOutput((logRow as Record<string, unknown> | null) ?? null),
      tableCounts,
      error: message,
    };
  }
}

export async function validateAndLogBackupRestore(
  supabase: SupabaseClient,
  backupLogId: number,
  reason?: string
): Promise<{
  ok: true;
  queued: true;
  backup_log_id: number;
  file_name: string;
  message: string;
}> {
  const { data: logRow, error } = await supabase
    .from("backup_logs")
    .select("id, file_name, status, backup_type, created_at")
    .eq("id", backupLogId)
    .maybeSingle();

  if (error || !logRow) {
    throw Object.assign(new Error("Backup log entry not found."), { status: 404 });
  }
  if (String(logRow.status) !== "success") {
    throw Object.assign(new Error("Only successful backups can be selected for restore."), {
      status: 400,
    });
  }

  return {
    ok: true,
    queued: true,
    backup_log_id: Number(logRow.id),
    file_name: String(logRow.file_name ?? ""),
    message: reason
      ? `Restore request logged for ${String(logRow.file_name ?? "")}.`
      : `Restore request validated for ${String(logRow.file_name ?? "")}.`,
  };
}
