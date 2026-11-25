import { NextResponse } from "next/server";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/rbac";
import { toErrorResponse } from "@/lib/errors";
import { getDashboardStatsService } from "@/services/dashboard.service";

export async function GET() {
  try {
    const session = await requireStaff();

    if (!getSupabaseSecretKey()) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SECRET_KEY is missing from environment variables." },
        { status: 503 }
      );
    }

    const supabase = createSupabaseServerClient(true);
    const stats = await getDashboardStatsService(supabase, session);
    return NextResponse.json(stats);
  } catch (err) {
    return toErrorResponse(err);
  }
}
