import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/rate-limit";
import { toErrorResponse } from "@/lib/errors";
import { registerUserAccountService } from "@/services/auth.service";
import { signupSchema } from "@/validators/auth";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  try {
    const parsed = signupSchema.parse(rawBody);
    const isStaffCreation =
      parsed.role === "admin" || parsed.role === "librarian";

    const actorSession = isStaffCreation ? await getServerSession() : null;
    if (isStaffCreation && !actorSession) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Only admins can create staff accounts." },
        { status: 401 }
      );
    }
    if (isStaffCreation && actorSession?.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Forbidden: Only admins can create staff accounts." },
        { status: 403 }
      );
    }

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "SUPABASE_SECRET_KEY is missing in this runtime. Locally: restart `npm run dev` after saving .env.local. On Vercel: add SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Project Settings -> Environment Variables and Redeploy.",
        },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);
    const result = await registerUserAccountService(
      supabase,
      parsed,
      actorSession,
      getClientIp(request)
    );

    return NextResponse.json(
      {
        ok: true,
        id: result.id,
        role: result.role,
        message: result.message,
      },
      { status: result.isStaffCreation ? 201 : 200 }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
