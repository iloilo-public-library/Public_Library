import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/rate-limit";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { toErrorResponse } from "@/lib/errors";
import { verifyOtpService } from "@/services/auth.service";
import { verifyOtpSchema } from "@/validators/auth";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const parsed = verifyOtpSchema.parse(rawBody);
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
    const result = await verifyOtpService(
      supabase,
      session,
      parsed,
      getClientIp(request)
    );
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
