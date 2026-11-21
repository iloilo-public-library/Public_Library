import type { SupabaseClient } from "@supabase/supabase-js";
import { listErrorLogs } from "@/lib/audit/error-logger";
import { runSupabaseBackup } from "@/lib/jobs/backup";
import { AdminMutationError } from "@/repositories/shared";

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
    backupLogs: logsRes.data ?? [],
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
  return { rows: data ?? [] };
}

export async function mutateSystemSettings(
  supabase: SupabaseClient,
  action: string,
  payload: Record<string, unknown>
) {
  if (action === "run_backup") {
    const scope =
      String(payload.scope ?? "Supabase Full Database Snapshot").trim() ||
      "Supabase Full Database Snapshot";
    const result = await runSupabaseBackup(supabase, {
      backupType: "manual",
      scope,
    });
    if (!result.ok) {
      throw new AdminMutationError(result.error || "Backup failed.", 500);
    }
    return { ok: true, log: result.log, tableCounts: result.tableCounts };
  }

  const validFreqs = new Set(["hourly", "daily", "weekly", "monthly", "off"]);
  const backupFrequency = validFreqs.has(String(payload.backup_frequency))
    ? String(payload.backup_frequency)
    : "weekly";
  const bypassRole =
    payload.bypass_role === "admin_librarian" ? "admin_librarian" : "admin";

  const { error } = await supabase.from("system_settings").upsert({
    id: 1,
    maintenance_enabled: Boolean(payload.maintenance_enabled),
    maintenance_message:
      String(payload.maintenance_message ?? "").trim() ||
      "The library system is currently under scheduled maintenance. We'll be back shortly.",
    bypass_role: bypassRole,
    lockdown_enabled: Boolean(payload.lockdown_enabled),
    backup_frequency: backupFrequency,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new AdminMutationError(error.message, 500);
  return { ok: true };
}
