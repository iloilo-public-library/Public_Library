import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/rbac";
import { runSupabaseBackup } from "@/lib/jobs/backup";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";

const manualBackupSchema = z.object({
  scope: z.string().trim().max(160).optional(),
});

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

  // Path 1: Scheduled Vercel Cron invocation
  if (isAuthorizedCronRequest(request)) {
    try {
      const { data: settingsRows } = await supabase
        .from("system_settings")
        .select("backup_frequency")
        .limit(1);
      const freq = String(settingsRows?.[0]?.backup_frequency || "weekly");

      if (freq === "off") {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "Scheduled backups are disabled in system_settings.",
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
          details: err instanceof Error ? err.stack || "" : "",
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

  const [settingsRes, logsRes] = await Promise.all([
    supabase.from("system_settings").select("backup_frequency, updated_at").limit(1),
    supabase
      .from("backup_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (logsRes.error) {
    return NextResponse.json({ ok: false, error: logsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    backup_frequency: settingsRes.data?.[0]?.backup_frequency ?? "weekly",
    logs: logsRes.data ?? [],
  });
}

export async function POST(request: Request) {
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

  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = manualBackupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid backup parameters." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient(true);
  const result = await runSupabaseBackup(supabase, {
    backupType: "manual",
    scope: parsed.data.scope || "Supabase Full Database Snapshot",
  });

  await recordAuditEvent(
    {
      action: "run_backup",
      resource: "backup_logs",
      targetId: typeof result.log?.id === "number" ? result.log.id : null,
      actorEmail: session.email,
      actorRole: session.role,
      route: "/api/backup",
      method: "POST",
    },
    supabase
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
