import crypto from "node:crypto";
import { downloadFromDropbox, uploadToDropbox } from "@/lib/storage/dropbox";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
export const VALID_ID_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"]);

export const SAFE_FILENAME_RE = /^[a-f0-9]{32}(\.(png|jpg|jpeg|webp|gif|pdf))?$/;
export const COVER_NAME_RE = /^[a-f0-9]{32}(\.(png|jpg|jpeg|webp|gif))?$/;

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

export async function uploadFileToDropboxFolder(
  folder: UploadFolderKey,
  file: File
): Promise<{ name: string; dropboxPath: string; url: string }> {
  if (!file || !file.name) {
    throw new Error("No file provided.");
  }

  const ext = getExtension(file.name);
  const allowed = folder === "valid-ids" ? VALID_ID_EXTENSIONS : IMAGE_EXTENSIONS;
  if (!allowed.has(ext)) {
    throw new Error(
      folder === "valid-ids"
        ? "Unsupported file type. Use PNG, JPG, JPEG, WEBP, GIF, or PDF."
        : "Unsupported image type. Use PNG, JPG, JPEG, WEBP, or GIF."
    );
  }

  const arrayBuf = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  if (bytes.byteLength === 0) {
    throw new Error("Uploaded file is empty.");
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("File size must be under 5 MB.");
  }

  const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const baseDir = DROPBOX_FOLDERS[folder]().replace(/\/+$/, "");
  const dropboxPath = `${baseDir}/${name}`;

  await uploadToDropbox(dropboxPath, bytes);

  const url = folder === "book-covers" ? `/cover/${name}` : dropboxPath;
  return { name, dropboxPath, url };
}

export async function downloadDropboxAsset(
  dropboxPath: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const bytes = await downloadFromDropbox(dropboxPath);
  if (!bytes) return null;
  return {
    bytes,
    contentType: guessMimeType(dropboxPath),
  };
}
