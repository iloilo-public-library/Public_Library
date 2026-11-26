import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/rbac";
import { enforceRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { RateLimitError } from "@/lib/errors";
import { isDropboxConfigured } from "@/lib/storage/dropbox";
import { uploadFileToDropboxFolder, type UploadFolderKey } from "@/lib/storage";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import { recordErrorLog } from "@/lib/audit/error-logger";

const folderSchema = z.enum(["book-covers", "event-banners", "card-photos", "valid-ids"]);

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — please sign in first." },
      { status: 401 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data payload." },
      { status: 400 }
    );
  }

  const rawFolder = String(formData.get("folder") || "book-covers").trim();
  const parsedFolder = folderSchema.safeParse(rawFolder);
  if (!parsedFolder.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid upload folder." },
      { status: 400 }
    );
  }

  const folder: UploadFolderKey = parsedFolder.data;
  if (folder !== "valid-ids" && !isStaffRole(session.role)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — staff access required for this upload folder." },
      { status: 403 }
    );
  }

  const supabase = getSupabaseSecretKey() ? createSupabaseServerClient(true) : null;
  try {
    await enforceRateLimit(
      {
        scope: "storage_upload",
        identifier: `user:${session.userId}:${getClientIp(request)}`,
        maxAttempts: 20,
        windowSeconds: 60,
      },
      supabase
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSec) } }
      );
    }
    throw err;
  }

  if (!isDropboxConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Dropbox storage credentials are not configured." },
      { status: 503 }
    );
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Missing file field in form data." },
      { status: 400 }
    );
  }

  try {
    const uploaded = await uploadFileToDropboxFolder(folder, fileEntry);

    if (supabase) {
      await recordAuditEvent(
        {
          action: "upload_file",
          resource: folder,
          actorId: session.userId,
          targetId: uploaded.name,
          actorRole: session.role,
          route: "/api/storage/upload",
          method: "POST",
        },
        supabase
      );
    }

    return NextResponse.json(
      {
        ok: true,
        name: uploaded.name,
        path: uploaded.dropboxPath,
        url: uploaded.url,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    await recordErrorLog({
      level: "error",
      source: "Storage",
      route: "/api/storage/upload",
      method: "POST",
      status_code: 400,
      message,
      user_email: `user#${session.userId}`,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
