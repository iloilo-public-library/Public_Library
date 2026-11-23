import crypto from "node:crypto";
import {
  deleteFromDropbox,
  downloadFromDropbox,
  isDropboxConfigured,
  uploadToDropbox,
} from "@/lib/storage/dropbox";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_EVENT_COVER_BYTES = 2 * 1024 * 1024;

export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
export const EVENT_COVER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
export const VALID_ID_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"]);

export const SAFE_FILENAME_RE = /^[a-f0-9]{32}(\.(png|jpg|jpeg|webp|gif|pdf))?$/;
export const COVER_NAME_RE = /^[a-f0-9]{32}(\.(png|jpg|jpeg|webp|gif))?$/;
export const EVENT_COVER_NAME_RE = /^[a-f0-9]{32}\.(png|jpg|jpeg|webp)$/;
export const EVENT_COVER_REF_RE = /^\/cover\/events\/([a-f0-9]{32}\.(png|jpg|jpeg|webp))$/;

export const DROPBOX_FOLDERS = {
  "book-covers": () =>
    process.env.DROPBOX_COVERS_FOLDER?.trim() || "/Iloilo_Public_Library_Covers",
  "event-banners": () =>
    process.env.DROPBOX_EVENTS_FOLDER?.trim() || "/Iloilo_Public_Library_Uploads/events",
  "card-photos": () =>
    process.env.DROPBOX_CARDS_FOLDER?.trim() || "/Iloilo_Public_Library_Uploads/card_photos",
  "valid-ids": () =>
    process.env.DROPBOX_VALID_IDS_FOLDER?.trim() || "/Iloilo_Public_Library_Uploads/valid_ids",
} as const;

export type UploadFolderKey = keyof typeof DROPBOX_FOLDERS;

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return "";
  return filename.slice(idx).toLowerCase();
}

export function guessMimeType(filename: string): string {
  const ext = getExtension(filename);
  switch (ext) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
}

export function detectImageSignature(bytes: Uint8Array): "jpeg" | "png" | "webp" | "gif" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "gif";
  return null;
}

export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const out: Uint8Array[] = [bytes.slice(0, 2)];
  let pos = 2;
  while (pos + 1 < bytes.length) {
    if (bytes[pos] !== 0xff) break;
    let marker = bytes[pos + 1];
    while (marker === 0xff && pos + 2 < bytes.length) {
      pos++;
      marker = bytes[pos + 1];
    }
    if (marker === 0xda || marker === 0xd9) {
      out.push(bytes.slice(pos));
      break;
    }
    if (pos + 3 >= bytes.length) {
      out.push(bytes.slice(pos));
      break;
    }
    const segLen = (bytes[pos + 2] << 8) | bytes[pos + 3];
    if (segLen < 2 || pos + 2 + segLen > bytes.length) {
      out.push(bytes.slice(pos));
      break;
    }
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) out.push(bytes.slice(pos, pos + 2 + segLen));
    pos += 2 + segLen;
  }
  const totalLen = out.reduce((acc, part) => acc + part.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of out) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

export function isValidEventCoverRef(ref: string): boolean {
  return EVENT_COVER_REF_RE.test(ref.trim());
}

export function extractEventCoverFilename(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const m = EVENT_COVER_REF_RE.exec(ref.trim());
  return m ? m[1] : null;
}

export async function deleteEventCoverByRef(ref: string | null | undefined): Promise<boolean> {
  const filename = extractEventCoverFilename(ref);
  if (!filename || !isDropboxConfigured()) return false;
  const baseDir = DROPBOX_FOLDERS["event-banners"]().replace(/\/+$/, "");
  return deleteFromDropbox(`${baseDir}/${filename}`);
}

export async function uploadFileToDropboxFolder(
  folder: UploadFolderKey,
  file: File
): Promise<{ name: string; dropboxPath: string; url: string }> {
  if (!file || !file.name) throw new Error("No file provided.");
  const ext = getExtension(file.name);
  const allowed =
    folder === "valid-ids"
      ? VALID_ID_EXTENSIONS
      : folder === "event-banners"
        ? EVENT_COVER_EXTENSIONS
        : IMAGE_EXTENSIONS;

  if (!allowed.has(ext)) {
    throw new Error(
      folder === "valid-ids"
        ? "Unsupported file type. Use PNG, JPG, JPEG, WEBP, GIF, or PDF."
        : folder === "event-banners"
          ? "Unsupported event cover type. Use JPEG, PNG, or WebP."
          : "Unsupported image type. Use PNG, JPG, JPEG, WEBP, or GIF."
    );
  }

  const arrayBuf = await file.arrayBuffer();
  let bytes: Uint8Array = new Uint8Array(arrayBuf);
  if (bytes.byteLength === 0) throw new Error("Uploaded file is empty.");

  const maxBytes = folder === "event-banners" ? MAX_EVENT_COVER_BYTES : MAX_UPLOAD_BYTES;
  if (bytes.byteLength > maxBytes) {
    throw new Error(
      folder === "event-banners"
        ? "Event cover image must be 2 MB or smaller."
        : "File size must be under 5 MB."
    );
  }

  let finalExt = ext;
  if (folder === "event-banners") {
    const sig = detectImageSignature(bytes);
    if (!sig || sig === "gif") {
      throw new Error("Invalid image file signature. Only real JPEG, PNG, or WebP files are allowed.");
    }
    if (sig === "jpeg") {
      bytes = stripJpegMetadata(bytes);
      finalExt = ".jpg";
    } else if (sig === "png") {
      finalExt = ".png";
    } else if (sig === "webp") {
      finalExt = ".webp";
    }
  }

  const name = `${crypto.randomBytes(16).toString("hex")}${finalExt}`;
  const baseDir = DROPBOX_FOLDERS[folder]().replace(/\/+$/, "");
  const dropboxPath = `${baseDir}/${name}`;

  await uploadToDropbox(dropboxPath, bytes);

  const url =
    folder === "book-covers"
      ? `/cover/${name}`
      : folder === "event-banners"
        ? `/cover/events/${name}`
        : dropboxPath;
  return { name, dropboxPath, url };
}

export async function downloadDropboxAsset(
  dropboxPath: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const bytes = await downloadFromDropbox(dropboxPath);
  if (!bytes) return null;
  return { bytes, contentType: guessMimeType(dropboxPath) };
}

export async function downloadEventCover(
  filename: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!EVENT_COVER_NAME_RE.test(filename)) return null;
  const baseDir = DROPBOX_FOLDERS["event-banners"]().replace(/\/+$/, "");
  return downloadDropboxAsset(`${baseDir}/${filename}`);
}
