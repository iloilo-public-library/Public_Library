import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/rate-limit";
import { toErrorResponse, ValidationError } from "@/lib/errors";
import { registerUserAccountService } from "@/services/auth.service";
import { signupSchema } from "@/validators/auth";

export async function POST(request: Request) {
  let rawBody: unknown;
  let validIdFile: File | null = null;
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid multipart form-data payload." },
        { status: 400 }
      );
    }

    const fields: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key === "valid_id") {
        if (value instanceof File) {
          if (value.size > 0) {
            validIdFile = value;
          } else if (value.name.trim().length > 0) {
            return toErrorResponse(new ValidationError("Uploaded valid ID file is empty."));
          }
        }
        continue;
      }
      if (typeof value === "string") {
        fields[key] = value;
      }
    }
    rawBody = fields;
  } else {
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload." },
        { status: 400 }
      );
    }
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
      getClientIp(request),
      validIdFile
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
