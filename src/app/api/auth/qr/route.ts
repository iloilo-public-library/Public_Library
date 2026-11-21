import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getServerSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  cleanupExpiredQrTokens,
  confirmQrToken,
  consumeConfirmedQrToken,
  createQrLoginToken,
  getQrTokenRow,
} from "@/lib/auth/qr";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { qrCheckQuerySchema, qrPostSchema } from "@/validators/auth";

export async function GET(request: Request) {
  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = qrCheckQuerySchema.safeParse({
    token: searchParams.get("token") || "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid QR token." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient(true);

  try {
    await cleanupExpiredQrTokens(supabase);
    const row = await getQrTokenRow(supabase, parsed.data.token);
    if (!row) {
      return NextResponse.json({ ok: true, status: "expired" });
    }

    if (row.status === "confirmed" && row.user_id) {
      const consumed = await consumeConfirmedQrToken(supabase, row);
      if (!consumed.ok) {
        return NextResponse.json({
          ok: false,
          status: "rejected",
          reason: consumed.reason,
        });
      }

      const response = NextResponse.json({
        ok: true,
        status: "confirmed",
        redirectTo: consumed.redirectTo,
        user: consumed.user,
      });

      response.cookies.set(SESSION_COOKIE_NAME, consumed.signedCookie, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 3600,
      });

      return response;
    }

    const remaining = Math.floor((Date.parse(row.expires_at) - Date.now()) / 1000);
    if (remaining <= 0) {
      return NextResponse.json({ ok: true, status: "expired" });
    }

    return NextResponse.json({
      ok: true,
      status: "pending",
      expires_in: remaining,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "QR status check failed.";
    await recordErrorLog(
      {
        level: "error",
        source: "Auth",
        route: "/api/auth/qr",
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

export async function POST(request: Request) {
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

  const parsed = qrPostSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid QR request." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient(true);

  try {
    if (parsed.data.action === "generate") {
      const created = await createQrLoginToken(supabase);
      const origin = new URL(request.url).origin;
      const scanUrl = `${origin}/scan-qr?token=${encodeURIComponent(created.token)}`;
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
        scanUrl
      )}`;

      return NextResponse.json({
        ok: true,
        token: created.token,
        expires_in: created.expiresIn,
        scan_url: scanUrl,
        qr_image_url: qrImageUrl,
      });
    }

    // Confirm action requires an authenticated mobile/active session
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Please sign in on this device before approving a QR login." },
        { status: 401 }
      );
    }

    const result = await confirmQrToken(supabase, parsed.data.token, session.userId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    await recordAuditEvent(
      {
        action: "confirm_qr_login",
        resource: "qr_login_tokens",
        targetId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        route: "/api/auth/qr",
        method: "POST",
      },
      supabase
    );

    return NextResponse.json({
      ok: true,
      message: "Desktop login approved! You may close this screen.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "QR authentication error.";
    await recordErrorLog(
      {
        level: "error",
        source: "Auth",
        route: "/api/auth/qr",
        method: "POST",
        status_code: 500,
        message,
        details: err instanceof Error ? err.stack || "" : "",
      },
      supabase
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
