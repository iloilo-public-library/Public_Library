import { gzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDropboxConfigured, uploadToDropbox } from "@/lib/storage/dropbox";
import { logger } from "@/lib/logger";

const BACKUP_TABLES = [
  "users",
  "books",
  "book_inventory",
  "library_cards",
  "library_card_books",
  "book_returns",
  "book_return_items",
  "account_requests",
  "announcements",
  "events",
  "system_settings",
  "user_favorites",
  "user_search_history",
  "user_appearance",
  "notification_reads",
  "login_sessions",
] as const;

export interface BackupRunOptions {
  backupType: "manual" | "scheduled";
  scope?: string;
}

export interface BackupRunResult {
  ok: boolean;
  log: Record<string, unknown> | null;
  tableCounts: Record<string, number>;
  error?: string;
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
    // Export every core Supabase table
    for (const table of BACKUP_TABLES) {
      const { data, error } = await supabase.from(table).select("*");
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
          dropboxPath,
          error: errorMessage,
        });
      }
    } else {
      status = "failed";
      errorMessage = "Dropbox credentials not configured (DROPBOX_APP_KEY / SECRET / REFRESH_TOKEN).";
    }

    const { data: logRow, error: logErr } = await supabase
      .from("backup_logs")
      .insert({
        backup_type: options.backupType,
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
      log: (logRow as Record<string, unknown> | null) ?? null,
      tableCounts,
      ...(errorMessage ? { error: errorMessage } : {}),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backup execution failed.";
    logger.error("Supabase backup job failed", { error: message });

    const { data: logRow } = await supabase
      .from("backup_logs")
      .insert({
        backup_type: options.backupType,
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
      log: (logRow as Record<string, unknown> | null) ?? null,
      tableCounts,
      error: message,
    };
  }
}
