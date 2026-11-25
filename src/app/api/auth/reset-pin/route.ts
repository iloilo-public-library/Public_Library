import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/auth/rate-limit";
import { toErrorResponse } from "@/lib/errors";
import { processPinResetService } from "@/services/auth.service";
import { resetPinRequestSchema } from "@/validators/auth";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const parsed = resetPinRequestSchema.parse(rawBody);

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);
    const origin = new URL(request.url).origin;
    const result = await processPinResetService(
      supabase,
      parsed,
      origin,
      getClientIp(request)
    );
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
