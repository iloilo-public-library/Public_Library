import { NextResponse } from "next/server";
import { getPendingMfaSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/rate-limit";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { toErrorResponse } from "@/lib/errors";
import { resendOtpService } from "@/services/auth.service";
import { resendOtpSchema } from "@/validators/auth";

export async function POST(request: Request) {
  let rawBody: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) rawBody = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    resendOtpSchema.parse(rawBody);
    const pendingMfa = await getPendingMfaSession();
    if (!pendingMfa) {
      return NextResponse.json(
        { ok: false, error: "MFA verification session is missing or expired. Please sign in again." },
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
    const result = await resendOtpService(
      supabase,
      pendingMfa,
      getClientIp(request)
    );
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
