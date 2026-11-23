import { NextResponse } from "next/server";
import { downloadEventCover, EVENT_COVER_NAME_RE } from "@/lib/storage";
import { isDropboxConfigured } from "@/lib/storage/dropbox";

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> }
) {
  const { name } = await context.params;
  if (!EVENT_COVER_NAME_RE.test(name || "")) {
    return NextResponse.json({ error: "Invalid event cover filename." }, { status: 400 });
  }
  if (!isDropboxConfigured()) {
    return NextResponse.json({ error: "Dropbox storage is not configured." }, { status: 503 });
  }
  const asset = await downloadEventCover(name);
  if (!asset) {
    return NextResponse.json({ error: "Event cover not found." }, { status: 404 });
  }
  return new NextResponse(Buffer.from(asset.bytes), {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
