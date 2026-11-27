import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { isAdminRole, verifyRepositoryActor } from "@/lib/auth/rbac";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import {
  isScheduledBackupDue,
  runSupabaseBackup,
  validateAndLogBackupRestore,
} from "@/lib/jobs/backup";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { toErrorResponse } from "@/lib/errors";
import { backupRestoreSchema, systemSettingsBackupSchema } from "@/validators/admin";

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  const supabase = createSupabaseServerClient(true);

  // Path 1: Scheduled Vercel Cron invocation (idempotent per configured window)
  if (isAuthorizedCronRequest(request)) {
    try {
      const [settingsRes, lastAutoRes] = await Promise.all([
        supabase.from("system_settings").select("backup_frequency").limit(1),
        supabase
          .from("backup_logs")
          .select("id, created_at")
          .eq("backup_type", "auto")
          .eq("status", "success")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      const freq = String(settingsRes.data?.[0]?.backup_frequency || "weekly");

      if (freq === "off") {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "Scheduled backups are disabled in system_settings.",
        });
      }

      const lastSuccessAt = lastAutoRes.data?.[0]?.created_at
        ? String(lastAutoRes.data[0].created_at)
        : null;

      if (!isScheduledBackupDue(freq, lastSuccessAt)) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: `Scheduled backup (${freq}) already completed for the current window.`,
        });
      }

      const result = await runSupabaseBackup(supabase, {
        backupType: "scheduled",
        scope: `Scheduled Supabase Snapshot (${freq})`,
      });

      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scheduled backup failed.";
      await recordErrorLog(
        {
          level: "error",
          source: "Backup",
          route: "/api/backup",
          method: "GET",
          status_code: 500,
          message,
        },
        supabase
      );
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  // Path 2: Admin inspecting backup logs & schedule
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — please sign in as admin." },
      { status: 401 }
    );
  }
  if (!isAdminRole(session.role)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — admin access required." },
      { status: 403 }
    );
  }

  try {
    await verifyRepositoryActor(supabase, session.userId, ["admin"], session.sessionToken);
  } catch (err) {
    return toErrorResponse(err);
  }

  const [settingsRes, logsRes] = await Promise.all([
    supabase.from("system_settings").select("backup_frequency, updated_at").limit(1),
    supabase
      .from("backup_logs")
      .select("id, backup_type, scope, file_name, file_size_bytes, status, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (logsRes.error) {
    return NextResponse.json({ ok: false, error: "Failed to load backup logs." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    backup_frequency: settingsRes.data?.[0]?.backup_frequency ?? "weekly",
    logs: logsRes.data ?? [],
  });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized — please sign in as admin." },
        { status: 401 }
      );
    }
    if (!isAdminRole(session.role)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden — only administrators can trigger backups." },
        { status: 403 }
      );
    }

    let body: unknown = {};
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
    }

    const parsed = systemSettingsBackupSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);
    await verifyRepositoryActor(supabase, session.userId, ["admin"], session.sessionToken);
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

    const result = await runSupabaseBackup(supabase, {
      backupType: "manual",
      scope: parsed.data.scope || "Supabase Full Database Snapshot",
    });

    await recordAuditEvent(
      {
        action: "run_backup",
        resource: "backup_logs",
        actorId: session.userId,
        targetId: typeof result.log?.id === "number" ? result.log.id : null,
        actorEmail: session.email,
        actorRole: session.role,
        route: "/api/backup",
        method: "POST",
      },
      supabase
    );

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized — please sign in as admin." },
        { status: 401 }
      );
    }
    if (!isAdminRole(session.role)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden — only administrators can restore backups." },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
    }

    const parsed = backupRestoreSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);
    await verifyRepositoryActor(supabase, session.userId, ["admin"], session.sessionToken);
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

    const result = await validateAndLogBackupRestore(
      supabase,
      parsed.data.backup_log_id,
      parsed.data.reason
    );

    await recordAuditEvent(
      {
        action: "restore_backup",
        resource: "backup_logs",
        actorId: session.userId,
        targetId: parsed.data.backup_log_id,
        actorEmail: session.email,
        actorRole: session.role,
        route: "/api/backup",
        method: "PUT",
        details: `backup_log_id=${parsed.data.backup_log_id}`,
      },
      supabase
    );

    return NextResponse.json(result);
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) {
      const status = Number((err as { status: unknown }).status) || 500;
      const message = err instanceof Error ? err.message : "Restore request failed.";
      return NextResponse.json({ ok: false, error: message }, { status });
    }
    return toErrorResponse(err);
  }
}
