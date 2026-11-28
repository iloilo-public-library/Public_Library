import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { touchSessionActivity } from "@/lib/auth/rbac";
import { getClientIp } from "@/lib/auth/rate-limit";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { requestMemberCardRenewal } from "@/repositories/member";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { AppError, toErrorResponse } from "@/lib/errors";
import { userRenewCardSchema } from "@/validators/user";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — please sign in." },
      { status: 401 }
    );
  }
  if (session.role !== "user") {
    return NextResponse.json(
      { ok: false, error: "Forbidden — member access required." },
      { status: 403 }
    );
  }
  void touchSessionActivity(session);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = userRenewCardSchema.safeParse(rawBody);
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
  try {
    const result = await requestMemberCardRenewal(
      supabase,
      session,
      parsed.data.card_id,
      parsed.data.reason,
      getClientIp(request)
    );

    await recordAuditEvent(
      {
        action: "request_card_renewal",
        resource: "library_cards",
        actorId: session.userId,
        targetId: parsed.data.card_id,
        actorRole: session.role,
        route: "/api/user/renew",
        method: "POST",
      },
      supabase
    );

    return NextResponse.json(result);
  } catch (err) {
    if (!(err instanceof AppError) || err.status >= 500) {
      await recordErrorLog(
        {
          level: "error",
          source: "User",
          route: "/api/user/renew",
          method: "POST",
          status_code: err instanceof AppError ? err.status : 500,
          message: err instanceof Error ? err.message : "Failed to request renewal.",
          user_email: session.email,
        },
        supabase
      );
    }
    return toErrorResponse(err);
  }
}
