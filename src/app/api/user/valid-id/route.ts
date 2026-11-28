import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { touchSessionActivity } from "@/lib/auth/rbac";
import { getClientIp } from "@/lib/auth/rate-limit";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { isDropboxConfigured } from "@/lib/storage/dropbox";
import { downloadDropboxAsset } from "@/lib/storage";
import { getMemberValidIdPath } from "@/repositories/member";
import { toErrorResponse } from "@/lib/errors";
import { userValidIdQuerySchema } from "@/validators/user";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — please sign in." },
      { status: 401 }
    );
  }
  if (session.role !== "user") {
    return NextResponse.json(
      { ok: false, error: "Forbidden — member access required." },
      { status: 403 }
    );
  }
  void touchSessionActivity(session);

  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsedQuery = userValidIdQuerySchema.safeParse(queryObj);
  if (!parsedQuery.success) {
    return toErrorResponse(parsedQuery.error);
  }

  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  if (!isDropboxConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Dropbox storage is not configured." },
      { status: 503 }
    );
  }

  const supabase = createSupabaseServerClient(true);
  try {
    const { dropboxPath } = await getMemberValidIdPath(
      supabase,
      session,
      getClientIp(request)
    );

    const asset = await downloadDropboxAsset(dropboxPath);
    if (!asset) {
      return NextResponse.json(
        { ok: false, error: "Valid ID file not found in Dropbox." },
        { status: 404 }
      );
    }

    return new NextResponse(Buffer.from(asset.bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
