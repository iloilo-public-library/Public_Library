import {
  COVER_NAME_RE,
  DROPBOX_FOLDERS,
  downloadDropboxAsset,
  uploadFileToDropboxFolder,
} from "@/lib/storage";

export async function uploadBookCover(file: File): Promise<string> {
  const result = await uploadFileToDropboxFolder("book-covers", file);
  return result.url; // "/cover/<uuid>.<ext>"
}

export async function downloadBookCover(
  name: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!COVER_NAME_RE.test(name)) {
    return null;
  }
  const coversDir = DROPBOX_FOLDERS["book-covers"]().replace(/\/+$/, "");
  return downloadDropboxAsset(`${coversDir}/${name}`);
}
