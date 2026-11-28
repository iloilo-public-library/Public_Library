import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getServerSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { enforceRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import {
  cleanupExpiredQrTokens,
  confirmQrToken,
  consumeConfirmedQrToken,
  createQrLoginToken,
  getQrTokenRow,
} from "@/lib/auth/qr";
import { generateQrDataUrl } from "@/lib/auth/qr-image";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { toErrorResponse } from "@/lib/errors";
import { qrCheckQuerySchema, qrPostSchema } from "@/validators/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = qrCheckQuerySchema.safeParse({
    ...queryObj,
    token: searchParams.get("token") || "",
  });
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
    await enforceRateLimit(
      {
        scope: "auth:qr:check",
        identifier: `${getClientIp(request)}:${parsed.data.token}`,
        maxAttempts: 60,
        windowSeconds: 60,
        blockSeconds: 120,
      },
      supabase
    );

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
      },
      supabase
    );
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = qrPostSchema.safeParse(rawBody);
  if (!parsed.success) {
    return toErrorResponse(parsed.error);
  }

  // Confirm action requires an authenticated mobile/active session check BEFORE DB check
  if (parsed.data.action === "confirm") {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Please sign in on this device before approving a QR login." },
        { status: 401 }
      );
    }

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);
    try {
      await enforceRateLimit(
        {
          scope: "auth:qr:confirm",
          identifier: `${getClientIp(request)}:${session.userId}`,
          maxAttempts: 12,
          windowSeconds: 300,
          blockSeconds: 300,
        },
        supabase
      );

      await verifyRepositoryActor(
        supabase,
        session.userId,
        ["admin", "librarian", "user"],
        session.sessionToken
      );

      const result = await confirmQrToken(supabase, parsed.data.token, session.userId);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
      }

      await recordAuditEvent(
        {
          action: "confirm_qr_login",
          resource: "qr_login_tokens",
          actorId: session.userId,
          targetId: session.userId,
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
      return toErrorResponse(err);
    }
  }

  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  const supabase = createSupabaseServerClient(true);

  try {
    await enforceRateLimit(
      {
        scope: "auth:qr:generate",
        identifier: getClientIp(request),
        maxAttempts: 20,
        windowSeconds: 300,
        blockSeconds: 300,
      },
      supabase
    );

    const created = await createQrLoginToken(supabase);
    const origin = new URL(request.url).origin;
    const scanUrl = `${origin}/scan-qr?token=${encodeURIComponent(created.token)}`;
    const qrImageUrl = generateQrDataUrl(scanUrl);

    return NextResponse.json({
      ok: true,
      token: created.token,
      expires_in: created.expiresIn,
      scan_url: scanUrl,
      qr_image_url: qrImageUrl,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
