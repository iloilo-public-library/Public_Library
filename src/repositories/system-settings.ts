import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { listErrorLogs, recordErrorLog } from "@/lib/audit/error-logger";
import { runSupabaseBackup, validateAndLogBackupRestore } from "@/lib/jobs/backup";
import { mapDatabaseError } from "@/lib/errors";
import { AdminMutationError } from "@/repositories/shared";
import {
  backupRestoreSchema,
  systemSettingsBackupSchema,
  systemSettingsLockdownSchema,
  systemSettingsScheduleSchema,
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
    id: r.id,
    backup_type: r.backup_type,
    scope: r.scope,
    file_name: r.file_name,
    file_size_bytes: r.file_size_bytes,
    status: r.status,
    error_message: r.error_message ?? "",
    created_at: r.created_at,
    size: formatBackupSize(r.file_size_bytes),
    type: rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : "",
    status_label: rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1) : "",
    error: r.error_message ?? "",
  };
}

/**
 * Terminates all active non-admin login sessions when emergency lockdown is enabled.
 * Admin sessions are NEVER terminated.
 */
async function terminateNonAdminSessions(supabase: SupabaseClient): Promise<number> {
  const { data: nonAdmins } = await supabase
    .from("users")
    .select("id")
    .neq("role", "admin")
    .limit(5000);

  const ids = (nonAdmins ?? []).map((u) => Number(u.id)).filter(Boolean);
  if (ids.length === 0) return 0;

  const nowIso = new Date().toISOString();
  await supabase
    .from("login_sessions")
    .update({ logout_at: nowIso })
    .in("user_id", ids)
    .is("logout_at", null);

  return ids.length;
}

export async function querySystemSettings(
  supabase: SupabaseClient,
  actorId?: number | null,
  sessionToken?: string | null
) {
  await verifyRepositoryActor(supabase, actorId, ["admin"], sessionToken);
  const [settingsRes, logsRes, errLogs] = await Promise.all([
    supabase.from("system_settings").select("*").limit(1),
    supabase
      .from("backup_logs")
      .select("id, backup_type, scope, file_name, file_size_bytes, status, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    listErrorLogs(supabase),
  ]);
  if (settingsRes.error) throw mapDatabaseError(settingsRes.error, "Failed to load system settings.");
  return {
    settings: settingsRes.data?.[0] ?? null,
    backupLogs: (logsRes.data ?? []).map((r) => enrichBackupLogRow(r as Record<string, unknown>)),
    errorCount: errLogs.filter((e) => !e.resolved).length,
  };
}

export async function queryErrorLogs(
  supabase: SupabaseClient,
  actorId?: number | null,
  sessionToken?: string | null
) {
  await verifyRepositoryActor(supabase, actorId, ["admin"], sessionToken);
  const rows = await listErrorLogs(supabase);
  return { rows };
}

export async function queryBackupLogs(
  supabase: SupabaseClient,
  actorId?: number | null,
  sessionToken?: string | null
) {
  await verifyRepositoryActor(supabase, actorId, ["admin"], sessionToken);
  const { data, error } = await supabase
    .from("backup_logs")
    .select("id, backup_type, scope, file_name, file_size_bytes, status, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw mapDatabaseError(error, "Failed to load backup logs.");
  return {
    rows: (data ?? []).map((r) => enrichBackupLogRow(r as Record<string, unknown>)),
  };
}

export async function mutateSystemSettings(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  payload: Record<string, unknown>
) {
  await verifyRepositoryActor(supabase, session.userId, ["admin"], session.sessionToken);

  if (action === "run_backup") {
    const parsed = systemSettingsBackupSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid backup scope.",
        400
      );
    }

    await enforceRateLimit(
      {
        scope: "admin:backup",
        identifier: `admin:${session.userId}`,
        maxAttempts: 5,
        windowSeconds: 600,
        blockSeconds: 300,
      },
      supabase
    );

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
      audit_details: `action=run_backup actor_id=${session.userId} scope=${scope}`,
    };
  }

  if (action === "restore_backup") {
    const parsed = backupRestoreSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Explicit confirmation is required to restore.",
        400
      );
    }

    await enforceRateLimit(
      {
        scope: "admin:restore",
        identifier: `admin:${session.userId}`,
        maxAttempts: 3,
        windowSeconds: 600,
        blockSeconds: 600,
      },
      supabase
    );

    try {
      const res = await validateAndLogBackupRestore(
        supabase,
        parsed.data.backup_log_id,
        parsed.data.reason
      );
      return {
        ...res,
        audit_details: `action=restore_backup actor_id=${session.userId} backup_log_id=${parsed.data.backup_log_id}`,
      };
    } catch (err) {
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status: unknown }).status)
          : 500;
      throw new AdminMutationError(
        err instanceof Error ? err.message : "Restore validation failed.",
        status
      );
    }
  }

  if (action === "toggle_lockdown") {
    const parsed = systemSettingsLockdownSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Confirmation and reason are required.",
        400
      );
    }

    const { enabled, reason } = parsed.data;
    const { error } = await supabase
      .from("system_settings")
      .update({
        lockdown_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw mapDatabaseError(error, "Failed to update lockdown state.");

    if (enabled) {
      await terminateNonAdminSessions(supabase);
    }

    await recordErrorLog(
      {
        level: "security",
        source: "System",
        route: "/api/admin/data?resource=system_settings",
        method: "PUT",
        status_code: 200,
        message: enabled ? "Emergency lockdown activated" : "Emergency lockdown disabled",
        details: `actor_id=${session.userId} reason=${reason}`,
        user_email: `user#${session.userId}`,
      },
      supabase
    );

    return {
      ok: true,
      lockdown_enabled: enabled,
      audit_details: `action=toggle_lockdown enabled=${enabled} actor_id=${session.userId}`,
    };
  }

  if (action === "update_schedule") {
    const parsed = systemSettingsScheduleSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message ||
          "Invalid frequency. Must be one of: hourly, daily, weekly, monthly, off",
        400
      );
    }
    const rawFreq = parsed.data.frequency ?? parsed.data.backup_frequency ?? "weekly";
    const { error } = await supabase
      .from("system_settings")
      .update({ backup_frequency: rawFreq, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw mapDatabaseError(error, "Failed to update backup schedule.");
    return {
      ok: true,
      frequency: rawFreq,
      audit_details: `action=update_schedule actor_id=${session.userId} frequency=${rawFreq}`,
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
    reason,
  } = parsed.data;

  // Read previous lockdown state so we terminate non-admin sessions on false -> true transition
  const { data: prevRows } = await supabase
    .from("system_settings")
    .select("lockdown_enabled")
    .eq("id", 1)
    .limit(1);
  const wasLocked = Boolean(prevRows?.[0]?.lockdown_enabled);

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

  if (error) throw mapDatabaseError(error, "Failed to save system settings.");

  if (lockdown_enabled && !wasLocked) {
    await terminateNonAdminSessions(supabase);
    await recordErrorLog(
      {
        level: "security",
        source: "System",
        route: "/api/admin/data?resource=system_settings",
        method: "PUT",
        status_code: 200,
        message: "Emergency lockdown activated",
        details: `actor_id=${session.userId}${reason ? ` reason=${reason}` : ""}`,
        user_email: `user#${session.userId}`,
      },
      supabase
    );
  } else if (!lockdown_enabled && wasLocked) {
    await recordErrorLog(
      {
        level: "security",
        source: "System",
        route: "/api/admin/data?resource=system_settings",
        method: "PUT",
        status_code: 200,
        message: "Emergency lockdown disabled",
        details: `actor_id=${session.userId}${reason ? ` reason=${reason}` : ""}`,
        user_email: `user#${session.userId}`,
      },
      supabase
    );
  }

  return {
    ok: true,
    audit_details: `action=update_system_settings actor_id=${session.userId} maintenance=${maintenance_enabled} lockdown=${lockdown_enabled} frequency=${backup_frequency}`,
  };
}
