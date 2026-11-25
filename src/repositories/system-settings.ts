import type { SupabaseClient } from "@supabase/supabase-js";
import { listErrorLogs } from "@/lib/audit/error-logger";
import { runSupabaseBackup } from "@/lib/jobs/backup";
import { AdminMutationError } from "@/repositories/shared";
import {
  systemSettingsBackupSchema,
  systemSettingsUpdateSchema,
} from "@/validators/admin";

function formatBackupSize(bytes: unknown): string {
  const n = Number(bytes ?? 0) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function enrichBackupLogRow(r: Record<string, unknown>) {
  const rawType = String(r.backup_type ?? "");
  const rawStatus = String(r.status ?? "");
  return {
    ...r,
    size: formatBackupSize(r.file_size_bytes),
    type: rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : "",
    status_label: rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1) : "",
    error: r.error_message ?? "",
  };
}

export async function querySystemSettings(supabase: SupabaseClient) {
  const [settingsRes, logsRes, errLogs] = await Promise.all([
    supabase.from("system_settings").select("*").limit(1),
    supabase
      .from("backup_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    listErrorLogs(supabase),
  ]);
  if (settingsRes.error) throw settingsRes.error;
  return {
    settings: settingsRes.data?.[0] ?? null,
    backupLogs: (logsRes.data ?? []).map((r) => enrichBackupLogRow(r as Record<string, unknown>)),
    errorCount: errLogs.filter((e) => !e.resolved).length,
  };
}

export async function queryErrorLogs(supabase: SupabaseClient) {
  const rows = await listErrorLogs(supabase);
  return { rows };
}

export async function queryBackupLogs(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("backup_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return {
    rows: (data ?? []).map((r) => enrichBackupLogRow(r as Record<string, unknown>)),
  };
}

export async function mutateSystemSettings(
  supabase: SupabaseClient,
  action: string,
  payload: Record<string, unknown>
) {
  if (action === "run_backup") {
    const parsed = systemSettingsBackupSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid backup scope.",
        400
      );
    }
    const scope = parsed.data.scope || "Supabase Full Database Snapshot";
    const result = await runSupabaseBackup(supabase, {
      backupType: "manual",
      scope,
    });
    if (!result.ok) {
      throw new AdminMutationError(result.error || "Backup failed.", 500);
    }
    return {
      ok: true,
      log: result.log,
      tableCounts: result.tableCounts,
      audit_details: `action=run_backup scope=${scope}`,
    };
  }

  if (action === "update_schedule") {
    const rawFreq = String(payload.frequency ?? payload.backup_frequency ?? "weekly").trim();
    const validFreqs = new Set(["hourly", "daily", "weekly", "monthly", "off"]);
    if (!validFreqs.has(rawFreq)) {
      throw new AdminMutationError(
        "Invalid frequency. Must be one of: hourly, daily, weekly, monthly, off",
        400
      );
    }
    const { error } = await supabase
      .from("system_settings")
      .update({ backup_frequency: rawFreq, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      frequency: rawFreq,
      audit_details: `action=update_schedule frequency=${rawFreq}`,
    };
  }

  const parsed = systemSettingsUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AdminMutationError(
      parsed.error.issues[0]?.message || "Invalid system settings payload.",
      400
    );
  }

  const {
    maintenance_enabled,
    maintenance_message,
    bypass_role,
    lockdown_enabled,
    backup_frequency,
  } = parsed.data;

  const { error } = await supabase.from("system_settings").upsert({
    id: 1,
    maintenance_enabled,
    maintenance_message:
      maintenance_message ||
      "The library system is currently under scheduled maintenance. We'll be back shortly.",
    bypass_role,
    lockdown_enabled,
    backup_frequency,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new AdminMutationError(error.message, 500);
  return {
    ok: true,
    audit_details: `action=update_system_settings maintenance=${maintenance_enabled} lockdown=${lockdown_enabled} frequency=${backup_frequency}`,
  };
}
