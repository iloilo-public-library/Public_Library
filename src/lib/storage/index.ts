import crypto from "node:crypto";
import { logger } from "@/lib/logger";
import {
  deleteFromDropbox,
  downloadFromDropbox,
  isDropboxConfigured,
  uploadToDropbox,
} from "@/lib/storage/dropbox";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_EVENT_COVER_BYTES = 2 * 1024 * 1024;
export const MAX_EVENT_COVER_WIDTH = 1600;

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

export function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    return bytes;
  }

  const STRIP_CHUNKS = new Set(["eXIf", "tEXt", "iTXt", "zTXt"]);
  const out: Uint8Array[] = [bytes.slice(0, 8)];
  let pos = 8;

  while (pos + 12 <= bytes.length) {
    const chunkLen =
      ((bytes[pos] << 24) |
        (bytes[pos + 1] << 16) |
        (bytes[pos + 2] << 8) |
        bytes[pos + 3]) >>>
      0;
    const totalChunkSize = 12 + chunkLen;
    if (pos + totalChunkSize > bytes.length) {
      out.push(bytes.slice(pos));
      break;
    }
    const type = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7]
    );
    if (!STRIP_CHUNKS.has(type)) {
      out.push(bytes.slice(pos, pos + totalChunkSize));
    }
    pos += totalChunkSize;
    if (type === "IEND") break;
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

export function stripWebpMetadata(bytes: Uint8Array): Uint8Array {
  if (
    bytes.length < 12 ||
    bytes[0] !== 0x52 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x46 ||
    bytes[8] !== 0x57 ||
    bytes[9] !== 0x45 ||
    bytes[10] !== 0x42 ||
    bytes[11] !== 0x50
  ) {
    return bytes;
  }

  const STRIP_CHUNKS = new Set(["EXIF", "XMP "]);
  const chunks: Uint8Array[] = [];
  let pos = 12;

  while (pos + 8 <= bytes.length) {
    const fourcc = String.fromCharCode(
      bytes[pos],
      bytes[pos + 1],
      bytes[pos + 2],
      bytes[pos + 3]
    );
    const chunkSize =
      (bytes[pos + 4] |
        (bytes[pos + 5] << 8) |
        (bytes[pos + 6] << 16) |
        (bytes[pos + 7] << 24)) >>>
      0;
    const paddedSize = chunkSize + (chunkSize & 1);
    const chunkEnd = Math.min(bytes.length, pos + 8 + paddedSize);

    if (!STRIP_CHUNKS.has(fourcc)) {
      const chunkCopy = bytes.slice(pos, chunkEnd);
      if (fourcc === "VP8X" && chunkCopy.length >= 9) {
        // Clear EXIF (bit 3 = 0x08) and XMP (bit 2 = 0x04) metadata flags in VP8X header
        chunkCopy[8] = chunkCopy[8] & ~0x0c;
      }
      chunks.push(chunkCopy);
    }

    pos += 8 + paddedSize;
  }

  const payloadLen = 4 + chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(8 + payloadLen);
  // "RIFF"
  merged.set(bytes.slice(0, 4), 0);
  // Updated RIFF chunk size (little-endian)
  merged[4] = payloadLen & 0xff;
  merged[5] = (payloadLen >>> 8) & 0xff;
  merged[6] = (payloadLen >>> 16) & 0xff;
  merged[7] = (payloadLen >>> 24) & 0xff;
  // "WEBP"
  merged.set(bytes.slice(8, 12), 8);

  let offset = 12;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export function stripImageMetadata(
  bytes: Uint8Array,
  sig: "jpeg" | "png" | "webp"
): Uint8Array {
  if (sig === "jpeg") return stripJpegMetadata(bytes);
  if (sig === "png") return stripPngMetadata(bytes);
  return stripWebpMetadata(bytes);
}

export function readImageDimensions(
  bytes: Uint8Array,
  sig: "jpeg" | "png" | "webp"
): { width: number; height: number } | null {
  if (sig === "png") {
    if (bytes.length < 24) return null;
    const isIhdr =
      bytes[12] === 0x49 &&
      bytes[13] === 0x48 &&
      bytes[14] === 0x44 &&
      bytes[15] === 0x52;
    if (!isIhdr) return null;
    const width =
      ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
    const height =
      ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (sig === "jpeg") {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let pos = 2;
    while (pos + 1 < bytes.length) {
      if (bytes[pos] !== 0xff) break;
      while (pos < bytes.length && bytes[pos] === 0xff) pos++;
      if (pos >= bytes.length) break;
      const marker = bytes[pos];
      pos++;
      if (marker === 0xd9 || marker === 0xda) break;
      if ((marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) continue;
      if (pos + 2 > bytes.length) break;
      const segLen = (bytes[pos] << 8) | bytes[pos + 1];
      if (segLen < 2 || pos + segLen > bytes.length) break;
      const isSof =
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof && segLen >= 7) {
        const height = (bytes[pos + 3] << 8) | bytes[pos + 4];
        const width = (bytes[pos + 5] << 8) | bytes[pos + 6];
        return width > 0 && height > 0 ? { width, height } : null;
      }
      pos += segLen;
    }
    return null;
  }

  if (sig === "webp") {
    if (bytes.length < 25) return null;
    const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunkType === "VP8 " && bytes.length >= 30) {
      // Lossy VP8 keyframe start code: 0x9D 0x01 0x2A at offset 23..25
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
      const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
      const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (chunkType === "VP8L" && bytes.length >= 25) {
      if (bytes[20] !== 0x2f) return null;
      const bits =
        (bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)) >>> 0;
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >>> 14) & 0x3fff) + 1;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (chunkType === "VP8X" && bytes.length >= 30) {
      const width = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
      const height = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    return null;
  }

  return null;
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
  try {
    const ok = await deleteFromDropbox(`${baseDir}/${filename}`);
    if (!ok) {
      logger.warn("Old event cover cleanup returned false", { filename });
    }
    return ok;
  } catch (err) {
    logger.warn("Old event cover cleanup failed", {
      filename,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
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
    const dims = readImageDimensions(bytes, sig);
    if (!dims || dims.width <= 0 || dims.height <= 0) {
      throw new Error("Unable to read image dimensions. Upload a valid JPEG, PNG, or WebP image.");
    }
    if (dims.width > MAX_EVENT_COVER_WIDTH) {
      throw new Error(
        `Event cover image width (${dims.width}px) exceeds the maximum allowed ${MAX_EVENT_COVER_WIDTH}px.`
      );
    }
    bytes = stripImageMetadata(bytes, sig);
    if (sig === "jpeg") {
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
