import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/rbac";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import { isDropboxConfigured } from "@/lib/storage/dropbox";
import { downloadDropboxAsset, DROPBOX_FOLDERS } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — please sign in." }, { status: 401 });
  }

  const { userId: rawUserId } = await context.params;
  const userId = Number(rawUserId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
  }

  if (!isStaffRole(session.role) && session.userId !== userId) {
    return NextResponse.json(
      { error: "Forbidden — insufficient permissions." },
      { status: 403 }
    );
  }

  if (!getSupabaseSecretKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY is not configured." },
      { status: 503 }
    );
  }

  if (!isDropboxConfigured()) {
    return NextResponse.json(
      { error: "Dropbox storage is not configured." },
      { status: 503 }
    );
  }

  const supabase = createSupabaseServerClient(true);
  const { data: user, error } = await supabase
    .from("users")
    .select("valid_id_path")
    .eq("id", userId)
    .single();

  if (error || !user || !user.valid_id_path) {
    return NextResponse.json({ error: "Valid ID not found for this user." }, { status: 404 });
  }

  const decryptedPath = safeDecryptPii(user.valid_id_path).trim();
  if (!decryptedPath) {
    return NextResponse.json({ error: "Valid ID path is unavailable." }, { status: 404 });
  }

  // Support both full Dropbox path ("/Iloilo_Public_Library_Uploads/valid_ids/...") and bare filename
  const dropboxPath = decryptedPath.startsWith("/")
    ? decryptedPath
    : `${DROPBOX_FOLDERS["valid-ids"]().replace(/\/+$/, "")}/${decryptedPath.replace(/^.*[\\/]/, "")}`;

  const asset = await downloadDropboxAsset(dropboxPath);
  if (!asset) {
    return NextResponse.json({ error: "Valid ID file not found in Dropbox." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(asset.bytes), {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "private, no-store",
    },
  });
}
