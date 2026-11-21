import type { SupabaseClient } from "@supabase/supabase-js";
import { listErrorLogs } from "@/lib/audit/error-logger";
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
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const fileName = `supabase_snapshot_${stamp}.json`;
    const scope = String(payload.scope ?? "Database Snapshot").trim() || "Database Snapshot";
    const { data, error } = await supabase
      .from("backup_logs")
      .insert({
        backup_type: "manual",
        scope,
        file_name: fileName,
        file_size_bytes: 0,
        dropbox_path: `/Supabase_Exports/${fileName}`,
        status: "success",
        error_message: "",
      })
      .select("*")
      .single();
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, log: data };
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
