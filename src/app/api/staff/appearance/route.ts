import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/rbac";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { toErrorResponse } from "@/lib/errors";
import {
  getStaffAppearanceService,
  updateStaffAppearanceService,
} from "@/services/dashboard.service";
import { staffAppearanceSchema } from "@/validators/admin";

export async function GET() {
  try {
    const session = await requireStaff();

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);
    const result = await getStaffAppearanceService(supabase, session);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireStaff();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload." },
        { status: 400 }
      );
    }

    const parsed = staffAppearanceSchema.parse(rawBody);

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);
    const result = await updateStaffAppearanceService(supabase, session, parsed);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  return PUT(request);
}
