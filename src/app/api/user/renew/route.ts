import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { requestMemberCardRenewal } from "@/repositories/member";
import { AdminMutationError } from "@/repositories/shared";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { userRenewCardSchema } from "@/validators/user";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — please sign in." },
      { status: 401 }
    );
  }

  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = userRenewCardSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid renewal request." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient(true);
  try {
    const result = await requestMemberCardRenewal(
      supabase,
      session,
      parsed.data.card_id,
      parsed.data.reason
    );

    await recordAuditEvent(
      {
        action: "request_card_renewal",
        resource: "library_cards",
        targetId: parsed.data.card_id,
        actorEmail: session.email,
        actorRole: session.role,
        route: "/api/user/renew",
        method: "POST",
      },
      supabase
    );

    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof AdminMutationError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Failed to request renewal.";
    if (status >= 500) {
      await recordErrorLog(
        {
          level: "error",
          source: "User",
          route: "/api/user/renew",
          method: "POST",
          status_code: status,
          message,
          user_email: session.email,
        },
        supabase
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
