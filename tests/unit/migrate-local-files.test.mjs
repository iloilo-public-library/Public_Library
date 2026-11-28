import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTargetPaths,
  classifyLocalFile,
  matchesDbReference,
  planLocalFileMigration,
  sha256Hex,
  toServableStorageName,
} from "../../src/lib/storage/migration.ts";

test("1. classifyLocalFile maps legacy uploads and valid_id_vault to exact Dropbox folders", () => {
  assert.equal(
    classifyLocalFile("legacy-flask/static/uploads/books/cover_14e8c16a7c8f40c3ae2bc14a48d98d1e.jpg"),
    "book-covers"
  );
  assert.equal(
    classifyLocalFile("legacy-flask/static/uploads/covers/b8a1496618e4473486df21af09121c6e.jpg"),
    "book-covers"
  );
  assert.equal(
    classifyLocalFile("legacy-flask/static/uploads/events/07990684914b42bcabf1a401868660cf.jpg"),
    "event-banners"
  );
  assert.equal(
    classifyLocalFile("legacy-flask/static/uploads/card_photos/member_0d2d68d3d1d14e0b8bb5b2609fdd24aa.webp"),
    "card-photos"
  );
  assert.equal(
    classifyLocalFile("valid_id_vault/0228a95ff76d4387bb5572f9c06f2c12.png"),
    "valid-ids"
  );
  assert.equal(classifyLocalFile("other/file.txt"), null);
});

test("2. toServableStorageName and buildTargetPaths produce route-compatible names and checksums", () => {
  const hash = sha256Hex(new Uint8Array([1, 2, 3, 4]));
  assert.equal(hash.length, 64);

  const bookName = toServableStorageName(
    "book-covers",
    "cover_14e8c16a7c8f40c3ae2bc14a48d98d1e.jpg",
    hash
  );
  assert.equal(bookName, "14e8c16a7c8f40c3ae2bc14a48d98d1e.jpg");
  assert.equal(buildTargetPaths("book-covers", bookName).dbValue, `/cover/${bookName}`);

  const eventName = toServableStorageName(
    "event-banners",
    "07990684914b42bcabf1a401868660cf.jpg",
    hash
  );
  assert.equal(eventName, "07990684914b42bcabf1a401868660cf.jpg");
  assert.equal(buildTargetPaths("event-banners", eventName).dbValue, `/cover/events/${eventName}`);

  const cardName = toServableStorageName(
    "card-photos",
    "member_0d2d68d3d1d14e0b8bb5b2609fdd24aa.webp",
    hash
  );
  assert.equal(cardName, "0d2d68d3d1d14e0b8bb5b2609fdd24aa.webp");

  const validIdName = toServableStorageName(
    "valid-ids",
    "0228a95ff76d4387bb5572f9c06f2c12.png",
    hash
  );
  assert.equal(validIdName, "0228a95ff76d4387bb5572f9c06f2c12.png");
});

test("3. planLocalFileMigration separates referenced vs unreferenced without writing anything", () => {
  const hashA = sha256Hex(new Uint8Array([10, 20]));
  const hashB = sha256Hex(new Uint8Array([30, 40]));

  const plan = planLocalFileMigration(
    [
      {
        absPath: "/tmp/a.jpg",
        relPath: "legacy-flask/static/uploads/events/07990684914b42bcabf1a401868660cf.jpg",
        basename: "07990684914b42bcabf1a401868660cf.jpg",
        sizeBytes: 2,
        sha256: hashA,
        type: "event-banners",
      },
      {
        absPath: "/tmp/b.png",
        relPath: "valid_id_vault/0228a95ff76d4387bb5572f9c06f2c12.png",
        basename: "0228a95ff76d4387bb5572f9c06f2c12.png",
        sizeBytes: 2,
        sha256: hashB,
        type: "valid-ids",
      },
    ],
    [
      {
        type: "event-banners",
        table: "events",
        column: "cover_image",
        rowId: 7,
        rawValue: "/static/uploads/events/07990684914b42bcabf1a401868660cf.jpg",
        decryptedValue: "/static/uploads/events/07990684914b42bcabf1a401868660cf.jpg",
        wasEncrypted: false,
      },
    ]
  );

  assert.equal(plan.referenced.length, 1);
  assert.equal(plan.referenced[0].references[0].needsDbUpdate, true);
  assert.equal(
    plan.referenced[0].targetDbValue,
    "/cover/events/07990684914b42bcabf1a401868660cf.jpg"
  );
  assert.equal(plan.unreferenced.length, 1);
  assert.equal(plan.unmapped.length, 0);
  assert.equal(
    matchesDbReference(
      "valid_id_vault/0228a95ff76d4387bb5572f9c06f2c12.png",
      "0228a95ff76d4387bb5572f9c06f2c12.png",
      "0228a95ff76d4387bb5572f9c06f2c12.png"
    ),
    true
  );
});
