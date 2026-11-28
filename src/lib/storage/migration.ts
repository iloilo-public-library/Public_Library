import crypto from "node:crypto";
import {
  COVER_NAME_RE,
  DROPBOX_FOLDERS,
  EVENT_COVER_NAME_RE,
  getExtension,
  SAFE_FILENAME_RE,
  type UploadFolderKey,
} from "@/lib/storage";

export interface LocalFileEntry {
  absPath: string;
  relPath: string;
  basename: string;
  sizeBytes: number;
  sha256: string;
  type: UploadFolderKey | null;
}

export interface DbReference {
  type: UploadFolderKey;
  table: "books" | "events" | "library_cards" | "users";
  column: string;
  rowId: number;
  rawValue: string;
  decryptedValue: string;
  wasEncrypted: boolean;
}

export interface PlannedMigrationItem {
  file: LocalFileEntry;
  type: UploadFolderKey;
  servableName: string;
  dropboxPath: string;
  targetDbValue: string;
  references: Array<{
    table: DbReference["table"];
    column: string;
    rowId: number;
    rawValue: string;
    needsDbUpdate: boolean;
    wasEncrypted: boolean;
  }>;
}

export interface MigrationPlan {
  referenced: PlannedMigrationItem[];
  unreferenced: LocalFileEntry[];
  unmapped: LocalFileEntry[];
}

export function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function classifyLocalFile(relPath: string): UploadFolderKey | null {
  const norm = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    norm.startsWith("legacy-flask/static/uploads/books/") ||
    norm.startsWith("legacy-flask/static/uploads/covers/")
  ) {
    return "book-covers";
  }
  if (norm.startsWith("legacy-flask/static/uploads/events/")) {
    return "event-banners";
  }
  if (norm.startsWith("legacy-flask/static/uploads/card_photos/")) {
    return "card-photos";
  }
  if (norm.startsWith("valid_id_vault/")) {
    return "valid-ids";
  }
  return null;
}

/**
 * Produces a filename guaranteed to be servable by /cover/[name],
 * /cover/events/[name], or protected valid-id/card-photo Dropbox paths.
 */
export function toServableStorageName(
  type: UploadFolderKey,
  basename: string,
  checksumHex: string
): string | null {
  const cleanBase = basename.trim().toLowerCase();
  const ext = getExtension(cleanBase);
  if (!ext) return null;

  if (type === "book-covers") {
    if (COVER_NAME_RE.test(cleanBase)) return cleanBase;
    const stripped = cleanBase.replace(/^cover_/, "");
    if (COVER_NAME_RE.test(stripped)) return stripped;
    const candidate = `${checksumHex.slice(0, 32)}${ext}`;
    return COVER_NAME_RE.test(candidate) ? candidate : null;
  }

  if (type === "event-banners") {
    const normalizedExt = ext === ".jpeg" ? ".jpg" : ext;
    if (EVENT_COVER_NAME_RE.test(cleanBase)) return cleanBase;
    const candidate = `${checksumHex.slice(0, 32)}${normalizedExt}`;
    return EVENT_COVER_NAME_RE.test(candidate) ? candidate : null;
  }

  if (type === "valid-ids") {
    if (SAFE_FILENAME_RE.test(cleanBase)) return cleanBase;
    const candidate = `${checksumHex.slice(0, 32)}${ext}`;
    return SAFE_FILENAME_RE.test(candidate) ? candidate : null;
  }

  if (type === "card-photos") {
    if (SAFE_FILENAME_RE.test(cleanBase)) return cleanBase;
    const stripped = cleanBase.replace(/^(member|borrower)_/, "");
    if (SAFE_FILENAME_RE.test(stripped)) return stripped;
    const candidate = `${checksumHex.slice(0, 32)}${ext}`;
    return SAFE_FILENAME_RE.test(candidate) ? candidate : null;
  }

  return null;
}

export function buildTargetPaths(
  type: UploadFolderKey,
  servableName: string
): { dropboxPath: string; dbValue: string } {
  const baseDir = DROPBOX_FOLDERS[type]().replace(/\/+$/, "");
  const dropboxPath = `${baseDir}/${servableName}`;
  const dbValue =
    type === "book-covers"
      ? `/cover/${servableName}`
      : type === "event-banners"
        ? `/cover/events/${servableName}`
        : dropboxPath;
  return { dropboxPath, dbValue };
}

export function matchesDbReference(
  decryptedValue: string,
  localBasename: string,
  servableName: string
): boolean {
  const val = decryptedValue.trim().replace(/\\/g, "/");
  if (!val) return false;
  const valBase = val.slice(val.lastIndexOf("/") + 1).toLowerCase();
  const baseLower = localBasename.toLowerCase();
  const servableLower = servableName.toLowerCase();
  return valBase === baseLower || valBase === servableLower;
}

export function planLocalFileMigration(
  localFiles: LocalFileEntry[],
  dbRefs: DbReference[]
): MigrationPlan {
  const referenced: PlannedMigrationItem[] = [];
  const unreferenced: LocalFileEntry[] = [];
  const unmapped: LocalFileEntry[] = [];

  for (const file of localFiles) {
    if (!file.type) {
      unmapped.push(file);
      continue;
    }
    const servableName = toServableStorageName(file.type, file.basename, file.sha256);
    if (!servableName) {
      unmapped.push(file);
      continue;
    }
    const { dropboxPath, dbValue } = buildTargetPaths(file.type, servableName);
    const matchedRefs = dbRefs
      .filter(
        (ref) =>
          ref.type === file.type &&
          matchesDbReference(ref.decryptedValue, file.basename, servableName)
      )
      .map((ref) => {
        // For valid-ids, if DB already stores either the exact Dropbox path OR the exact bare servableName,
        // both /api/admin/valid-id/[userId] and /api/user/valid-id already resolve it cleanly.
        const alreadyCompatible =
          ref.decryptedValue.trim() === dbValue ||
          (file.type === "valid-ids" && ref.decryptedValue.trim() === servableName);
        return {
          table: ref.table,
          column: ref.column,
          rowId: ref.rowId,
          rawValue: ref.rawValue,
          needsDbUpdate: !alreadyCompatible,
          wasEncrypted: ref.wasEncrypted,
        };
      });

    if (matchedRefs.length === 0) {
      unreferenced.push(file);
    } else {
      referenced.push({
        file,
        type: file.type,
        servableName,
        dropboxPath,
        targetDbValue: dbValue,
        references: matchedRefs,
      });
    }
  }

  return { referenced, unreferenced, unmapped };
}

export const ROLLBACK_COMMAND =
  "node --import ./tests/unit/ts-loader.mjs scripts/migrate-local-files-to-dropbox.ts --rollback";
