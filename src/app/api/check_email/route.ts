import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { enforceRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { RateLimitError, toErrorResponse } from "@/lib/errors";
import { checkEmailAvailabilityService } from "@/services/auth.service";
import { checkEmailQuerySchema } from "@/validators/auth";
import { emailSchema } from "@/validators/common";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsedQuery = checkEmailQuerySchema.safeParse(queryObj);

  if (!parsedQuery.success) {
    return NextResponse.json({
      available: false,
      taken: false,
      reason: "Enter a valid email address.",
    });
  }

  const emailCheck = emailSchema.safeParse(parsedQuery.data.email);
  if (!emailCheck.success) {
    return NextResponse.json({
      available: false,
      taken: false,
      reason: "Enter a valid email address.",
    });
  }

  if (!getSupabaseSecretKey()) {
    return NextResponse.json({ available: true, taken: false, reason: "" });
  }

  try {
    const supabase = createSupabaseServerClient(true);
    await enforceRateLimit(
      {
        scope: "auth:check_email",
        identifier: getClientIp(request),
        maxAttempts: 30,
        windowSeconds: 60,
        blockSeconds: 120,
      },
      supabase
    );
    const result = await checkEmailAvailabilityService(supabase, emailCheck.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return toErrorResponse(err);
    }
    return NextResponse.json({ available: true, taken: false, reason: "" });
  }
}
