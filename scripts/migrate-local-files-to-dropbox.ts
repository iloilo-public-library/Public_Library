import fs from "node:fs";
import path from "node:path";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";
import { maybeEncryptPii, safeDecryptPii } from "@/lib/crypto/fernet";
import { downloadFromDropbox, isDropboxConfigured, uploadToDropbox } from "@/lib/storage/dropbox";
import { downloadDropboxAsset } from "@/lib/storage";
import {
  classifyLocalFile,
  planLocalFileMigration,
  sha256Hex,
  type DbReference,
  type LocalFileEntry,
} from "@/lib/storage/migration";
import { GET as getBookCoverRoute } from "@/app/cover/[name]/route";
import { GET as getEventCoverRoute } from "@/app/cover/events/[name]/route";

const ROOT = process.cwd();
const MAPPING_FILE = path.join(ROOT, "scripts", "migration-mapping.json");
const UPLOAD_DELAY_MS = 300;
const MAX_RETRIES = 3;

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

function walkFiles(dirAbs: string, out: LocalFileEntry[] = []): LocalFileEntry[] {
  if (!fs.existsSync(dirAbs)) return out;
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const absPath = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absPath, out);
    } else if (entry.isFile()) {
      const relPath = path.relative(ROOT, absPath).replace(/\\/g, "/");
      const bytes = fs.readFileSync(absPath);
      out.push({
        absPath,
        relPath,
        basename: entry.name,
        sizeBytes: bytes.byteLength,
        sha256: sha256Hex(bytes),
        type: classifyLocalFile(relPath),
      });
    }
  }
  return out;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /authorization failed|refresh token|missing_scope|401|403|credentials are missing/i.test(
    msg
  );
}

async function uploadWithRetry(dropboxPath: string, bytes: Uint8Array): Promise<void> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      await uploadToDropbox(dropboxPath, bytes);
      return;
    } catch (err) {
      if (isAuthError(err) || attempt >= MAX_RETRIES) {
        throw err;
      }
      await sleep(500 * attempt);
    }
  }
}

async function collectDbReferences(): Promise<DbReference[]> {
  const supabase = createSupabaseServerClient(true);
  const refs: DbReference[] = [];

  const [booksRes, eventsRes, cardsRes, usersRes] = await Promise.all([
    supabase.from("books").select("id, thumbnail_url").not("thumbnail_url", "is", null).limit(5000),
    supabase.from("events").select("id, cover_image").not("cover_image", "is", null).limit(5000),
    supabase.from("library_cards").select("id, photo_path").not("photo_path", "is", null).limit(5000),
    supabase.from("users").select("id, valid_id_path").not("valid_id_path", "is", null).limit(5000),
  ]);

  if (booksRes.error) throw new Error(`Failed to query books: ${booksRes.error.message}`);
  if (eventsRes.error) throw new Error(`Failed to query events: ${eventsRes.error.message}`);
  if (cardsRes.error) throw new Error(`Failed to query library_cards: ${cardsRes.error.message}`);
  if (usersRes.error) throw new Error(`Failed to query users: ${usersRes.error.message}`);

  for (const b of booksRes.data ?? []) {
    const raw = String(b.thumbnail_url ?? "").trim();
    if (raw) {
      refs.push({
        type: "book-covers",
        table: "books",
        column: "thumbnail_url",
        rowId: Number(b.id),
        rawValue: raw,
        decryptedValue: raw,
        wasEncrypted: false,
      });
    }
  }

  for (const ev of eventsRes.data ?? []) {
    const raw = String(ev.cover_image ?? "").trim();
    if (raw) {
      refs.push({
        type: "event-banners",
        table: "events",
        column: "cover_image",
        rowId: Number(ev.id),
        rawValue: raw,
        decryptedValue: raw,
        wasEncrypted: false,
      });
    }
  }

  for (const c of cardsRes.data ?? []) {
    const raw = String(c.photo_path ?? "").trim();
    if (raw) {
      refs.push({
        type: "card-photos",
        table: "library_cards",
        column: "photo_path",
        rowId: Number(c.id),
        rawValue: raw,
        decryptedValue: raw,
        wasEncrypted: false,
      });
    }
  }

  for (const u of usersRes.data ?? []) {
    const raw = String(u.valid_id_path ?? "").trim();
    if (raw) {
      const wasEncrypted = raw.startsWith("gAAAAAB");
      const decrypted = wasEncrypted ? safeDecryptPii(raw).trim() : raw;
      refs.push({
        type: "valid-ids",
        table: "users",
        column: "valid_id_path",
        rowId: Number(u.id),
        rawValue: raw,
        decryptedValue: decrypted,
        wasEncrypted,
      });
    }
  }

  return refs;
}

interface MappingEntry {
  type: string;
  table: string;
  column: string;
  rowId: number;
  oldValue: string;
  newValue: string;
  dropboxPath: string;
  sha256: string;
}

async function runRollback() {
  if (!fs.existsSync(MAPPING_FILE)) {
    console.error("Mapping file scripts/migration-mapping.json not found.");
    process.exit(1);
  }
  const parsed = JSON.parse(fs.readFileSync(MAPPING_FILE, "utf8")) as {
    entries?: MappingEntry[];
  };
  const entries = parsed.entries ?? [];
  const supabase = createSupabaseServerClient(true);
  let restored = 0;
  for (const e of entries) {
    if (e.oldValue === e.newValue) continue;
    const { error } = await supabase
      .from(e.table)
      .update({ [e.column]: e.oldValue })
      .eq("id", e.rowId);
    if (error) {
      console.error(`Rollback failed for ${e.table}#${e.rowId}.${e.column}: ${error.message}`);
      process.exit(1);
    }
    restored++;
  }
  console.log(`Rollback complete: ${restored} DB row(s) restored.`);
}

async function main() {
  loadEnvFile(path.join(ROOT, ".env"));
  loadEnvFile(path.join(ROOT, ".env.local"));

  const args = new Set(process.argv.slice(2));
  const isApply = args.has("--apply");
  const isVerify = args.has("--verify");
  const isRollback = args.has("--rollback");

  if (!getSupabaseSecretKey()) {
    console.error("SUPABASE_SECRET_KEY is not configured.");
    process.exit(1);
  }

  if (isRollback) {
    await runRollback();
    return;
  }

  const localFiles = [
    ...walkFiles(path.join(ROOT, "legacy-flask", "static", "uploads")),
    ...walkFiles(path.join(ROOT, "valid_id_vault")),
  ];

  const dbRefs = await collectDbReferences();
  const plan = planLocalFileMigration(localFiles, dbRefs);

  const countByType = (list: Array<{ type: string | null }>) => {
    const counts: Record<string, number> = {
      "book-covers": 0,
      "event-banners": 0,
      "card-photos": 0,
      "valid-ids": 0,
    };
    for (const item of list) {
      if (item.type && item.type in counts) counts[item.type]++;
    }
    return counts;
  };

  console.log("=== Local Files -> Dropbox Migration Plan ===");
  console.log(`Mode: ${isApply ? "APPLY" : isVerify ? "VERIFY" : "DRY RUN (no uploads, no DB writes)"}`);
  console.log(`Total local files found: ${localFiles.length}`, countByType(localFiles));
  console.log(`Referenced by DB rows: ${plan.referenced.length}`, countByType(plan.referenced));
  console.log(`Unreferenced (review manually, will NOT upload): ${plan.unreferenced.length}`, countByType(plan.unreferenced));
  console.log(`Unmapped: ${plan.unmapped.length}`);

  for (const item of plan.referenced) {
    const label = item.type === "valid-ids" ? `valid-id(sha256:${item.file.sha256.slice(0, 12)})` : item.file.relPath;
    const dbUpdates = item.references.filter((r) => r.needsDbUpdate).length;
    console.log(
      `  [REF] ${item.type} | ${label} -> ${item.dropboxPath} | rows=${item.references.map((r) => `${r.table}#${r.rowId}`).join(",")} | dbUpdates=${dbUpdates}`
    );
  }

  for (const u of plan.unreferenced) {
    const label = u.type === "valid-ids" ? `valid-id(sha256:${u.sha256.slice(0, 12)}, ${u.sizeBytes}B)` : `${u.relPath} (${u.sizeBytes}B)`;
    console.log(`  [UNREF] ${u.type ?? "unknown"} | ${label}`);
  }

  if (!isApply && !isVerify) {
    console.log("Dry run complete. Re-run with --apply to upload referenced files and update DB.");
    return;
  }

  if (!isDropboxConfigured()) {
    console.error("Dropbox credentials are not configured.");
    process.exit(1);
  }

  const supabase = createSupabaseServerClient(true);
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const mappingEntries: MappingEntry[] = [];

  if (isApply) {
    for (const item of plan.referenced) {
      try {
        const localBytes = new Uint8Array(fs.readFileSync(item.file.absPath));
        const existingBytes = await downloadFromDropbox(item.dropboxPath);
        if (existingBytes && sha256Hex(existingBytes) === item.file.sha256) {
          skipped++;
        } else {
          await uploadWithRetry(item.dropboxPath, localBytes);
          uploaded++;
          await sleep(UPLOAD_DELAY_MS);
        }

        for (const ref of item.references) {
          const newStoredValue =
            ref.needsDbUpdate
              ? ref.wasEncrypted
                ? maybeEncryptPii(item.targetDbValue)
                : item.targetDbValue
              : ref.rawValue;

          if (ref.needsDbUpdate) {
            const { error } = await supabase
              .from(ref.table)
              .update({ [ref.column]: newStoredValue })
              .eq("id", ref.rowId);
            if (error) {
              throw new Error(`DB update failed for ${ref.table}#${ref.rowId}: ${error.message}`);
            }
          }

          mappingEntries.push({
            type: item.type,
            table: ref.table,
            column: ref.column,
            rowId: ref.rowId,
            oldValue: ref.rawValue,
            newValue: newStoredValue,
            dropboxPath: item.dropboxPath,
            sha256: item.file.sha256,
          });
        }
      } catch (err) {
        failed++;
        console.error(
          `Failed item (${item.type}, sha256:${item.file.sha256.slice(0, 12)}): ${err instanceof Error ? err.message : String(err)}`
        );
        if (isAuthError(err)) {
          console.error("Stopping immediately due to Dropbox auth error.");
          process.exit(1);
        }
      }
    }

    fs.writeFileSync(
      MAPPING_FILE,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          entries: mappingEntries,
        },
        null,
        2
      ),
      "utf8"
    );

    console.log(
      `APPLY summary: uploaded=${uploaded}, skipped=${skipped}, failed=${failed}, mappingRows=${mappingEntries.length}`
    );
  }

  if (isApply || isVerify) {
    const verifyStats: Record<string, { pass: number; fail: number }> = {
      "book-covers": { pass: 0, fail: 0 },
      "event-banners": { pass: 0, fail: 0 },
      "card-photos": { pass: 0, fail: 0 },
      "valid-ids": { pass: 0, fail: 0 },
    };

    for (const item of plan.referenced) {
      try {
        let servedBytes: Uint8Array | null = null;
        if (item.type === "book-covers") {
          const resp = await getBookCoverRoute(new Request("http://localhost/cover/" + item.servableName), {
            params: Promise.resolve({ name: item.servableName }),
          });
          if (resp.status === 200) {
            servedBytes = new Uint8Array(await resp.arrayBuffer());
          }
        } else if (item.type === "event-banners") {
          const resp = await getEventCoverRoute(
            new Request("http://localhost/cover/events/" + item.servableName),
            { params: Promise.resolve({ name: item.servableName }) }
          );
          if (resp.status === 200) {
            servedBytes = new Uint8Array(await resp.arrayBuffer());
          }
        } else {
          // card-photos & valid-ids: verify through the app's protected Dropbox asset helper
          const asset = await downloadDropboxAsset(item.dropboxPath);
          if (asset) servedBytes = asset.bytes;
        }

        if (servedBytes && sha256Hex(servedBytes) === item.file.sha256) {
          verifyStats[item.type].pass++;
        } else {
          verifyStats[item.type].fail++;
        }
      } catch {
        verifyStats[item.type].fail++;
      }
    }

    console.log("VERIFY summary:", JSON.stringify(verifyStats));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
