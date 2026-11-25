import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
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
    const parsed = resendOtpSchema.parse(rawBody);
    const session = await getServerSession();
    const targetEmail = parsed.email?.trim().toLowerCase() || session?.email || "";
    if (!session && !targetEmail) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized — sign in or supply your account email." },
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
      session,
      parsed.email,
      getClientIp(request)
    );
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
