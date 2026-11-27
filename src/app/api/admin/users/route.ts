import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { isStaffRole, touchSessionActivity } from "@/lib/auth/rbac";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { AdminMutationError } from "@/repositories/shared";
import { toErrorResponse } from "@/lib/errors";
import { getAdminUsersData } from "@/services/admin.service";
import { adminUsersQuerySchema } from "@/validators/admin";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session || !isStaffRole(session.role)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — staff access required." },
      { status: session ? 403 : 401 }
    );
  }
  void touchSessionActivity(session);

  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const queryInput = Object.fromEntries(url.searchParams.entries());
  const parsed = adminUsersQuerySchema.safeParse({
    ...queryInput,
    id: url.searchParams.get("id") || undefined,
    q: url.searchParams.get("q") || "",
    role: url.searchParams.get("role") || "all",
    mode: url.searchParams.get("mode") || "full",
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid query parameters.",
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseServerClient(true);
    const payload = await getAdminUsersData(supabase, session, parsed.data);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AdminMutationError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    return toErrorResponse(error);
  }
}
