"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Barcode,
  BookCheck,
  BookOpen,
  CheckCircle2,
  Hash,
  Layers,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AddBookWithCopiesInput } from "@/types/inventory";

interface AddBookModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: AddBookWithCopiesInput) => Promise<void>;
}

const FIELD_LABEL =
  "mb-1.5 flex items-center justify-between text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-tl/85";
const FIELD_INPUT =
  "w-full rounded-xl border border-white/12 bg-bg1/85 px-3 py-2 text-xs text-white placeholder:text-tl/40 transition focus:border-accent/60 focus:bg-bg1 focus:outline-none focus:ring-2 focus:ring-accent/15";

const CATEGORY_PRESETS = [
  "Fiction & Literature",
  "Computer Science & IT",
  "Philippine Literature",
  "Philosophy & Ethics",
  "Biography & History",
  "Science & Technology",
  "General Reference",
];

export function AddBookModal({ open, onClose, onSubmit }: AddBookModalProps) {
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [callNumber, setCallNumber] = useState("");
  const [accessionPrefix, setAccessionPrefix] = useState("");
  const [category, setCategory] = useState("General Reference");
  const [bookClass, setBookClass] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [copiesToAdd, setCopiesToAdd] = useState(1);
  const [shelfLocation, setShelfLocation] = useState("");
  const [sourceOfFund, setSourceOfFund] = useState("");
  const [isBorrowable, setIsBorrowable] = useState(true);

  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupNotice, setLookupNotice] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  const previewPrefix = useMemo(() => {
    const raw = accessionPrefix.trim() || callNumber.trim() || "ICPL-BK";
    return raw.toUpperCase().replace(/\s+/g, "-");
  }, [accessionPrefix, callNumber]);

  const sampleTags = useMemo(() => {
    const count = Math.max(1, Math.min(500, copiesToAdd || 1));
    const fmt = (n: number) => `${previewPrefix}-C${String(n).padStart(3, "0")}`;
    if (count === 1) return [fmt(1)];
    if (count === 2) return [fmt(1), fmt(2)];
    if (count === 3) return [fmt(1), fmt(2), fmt(3)];
    return [fmt(1), fmt(2), "…", fmt(count)];
  }, [copiesToAdd, previewPrefix]);

  if (!open) return null;

  async function handleIsbnLookup() {
    const clean = isbn.trim();
    if (!clean) {
      setLookupNotice({
        tone: "err",
        text: "Enter an ISBN first to auto-fill title, author, and publisher metadata.",
      });
      return;
    }
    setLookingUp(true);
    setLookupNotice(null);
    try {
      const res = await fetch(
        `/api/admin/data?resource=isbn_lookup&isbn=${encodeURIComponent(clean)}`
      );
      const data = (await res.json()) as {
        found?: boolean;
        book?: Record<string, unknown>;
      };
      if (!data.found || !data.book) {
        setLookupNotice({
          tone: "err",
          text: "No matching record found in Google Books / Open Library. Enter details manually.",
        });
        return;
      }
      const b = data.book;
      if (b.title) setTitle(String(b.title));
      if (b.author) setAuthor(String(b.author));
      if (b.publisher) setPublisher(String(b.publisher));
      if (b.published_date) setPublishedDate(String(b.published_date));
      if (b.category) setCategory(String(b.category));
      if (b.class) setBookClass(String(b.class));
      setLookupNotice({
        tone: "ok",
        text: `Auto-filled bibliographic metadata from ${String(b.api_source || "catalog lookup")}.`,
      });
    } catch {
      setLookupNotice({
        tone: "err",
        text: "ISBN lookup service unavailable. You can fill in the fields below manually.",
      });
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setLookupNotice(null);
    try {
      await onSubmit({
        isbn: isbn.trim(),
        title: title.trim(),
        author: author.trim(),
        call_number: callNumber.trim() || null,
        catalog_code: callNumber.trim() || null,
        accession_prefix: accessionPrefix.trim() || null,
        category: category.trim() || null,
        class: bookClass.trim() || null,
        publisher: publisher.trim() || null,
        published_date: publishedDate.trim() || null,
        copies_to_add: Math.max(1, Math.min(500, copiesToAdd || 1)),
        shelf_location: shelfLocation.trim() || null,
        source_of_fund: sourceOfFund.trim() || null,
        is_borrowable: isBorrowable,
      });
    } catch (err) {
      setLookupNotice({
        tone: "err",
        text: err instanceof Error ? err.message : "Failed to save book record.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 text-xs">
      {lookupNotice && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
            lookupNotice.tone === "ok"
              ? "border-accent2/35 bg-accent2/12 text-accent2"
              : "border-danger/35 bg-danger/12 text-danger"
          }`}
        >
          {lookupNotice.tone === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{lookupNotice.text}</span>
        </div>
      )}

      {/* SECTION 1: BIBLIOGRAPHIC METADATA */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3.5">
        <div className="flex items-center justify-between border-b border-white/8 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-accent/25 bg-accent/12 text-accent">
              <BookOpen className="h-3.5 w-3.5" />
            </span>
            <div>
              <h3 className="text-xs font-bold tracking-tight text-white">
                Bibliographic Information
              </h3>
              <p className="text-[0.68rem] text-tl/65">
                Scan or type an ISBN to auto-populate catalog details
              </p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[0.64rem] text-tl/70">
            Step 1 of 2
          </span>
        </div>

        {/* ISBN + Lookup */}
        <div>
          <label className={FIELD_LABEL}>
            <span>ISBN-10 / ISBN-13 *</span>
            <span className="font-mono text-[0.63rem] font-normal lowercase text-accent/80">
              supports barcode scanner
            </span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tl/45" />
              <input
                required
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978-0-14-044913-6"
                className={`${FIELD_INPUT} pl-8 font-mono`}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={lookingUp}
              onClick={handleIsbnLookup}
              className="shrink-0"
            >
              {lookingUp ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-accent" />
              )}
              Auto-Fill ISBN
            </Button>
          </div>
        </div>

        {/* Title & Author */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={FIELD_LABEL}>
              <span>Book Title *</span>
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fundamentals of Information Systems"
              className={FIELD_INPUT}
            />
          </div>

          <div>
            <label className={FIELD_LABEL}>
              <span>Primary Author(s) *</span>
            </label>
            <input
              required
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. David Kim & Michael G. Solomon"
              className={FIELD_INPUT}
            />
          </div>
        </div>

        {/* Category, Class, Publisher, Published Year */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={FIELD_LABEL}>
              <span>Collection Category</span>
            </label>
            <input
              list="icpl-category-presets"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Select or type category"
              className={FIELD_INPUT}
            />
            <datalist id="icpl-category-presets">
              {CATEGORY_PRESETS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={FIELD_LABEL}>
              <span>Class / Genre</span>
            </label>
            <input
              value={bookClass}
              onChange={(e) => setBookClass(e.target.value)}
              placeholder="e.g. Textbook"
              className={FIELD_INPUT}
            />
          </div>

          <div>
            <label className={FIELD_LABEL}>
              <span>Published</span>
            </label>
            <input
              value={publishedDate}
              onChange={(e) => setPublishedDate(e.target.value)}
              placeholder="e.g. 2024"
              className={`${FIELD_INPUT} font-mono`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={FIELD_LABEL}>
              <span>Publisher</span>
            </label>
            <input
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="e.g. Penguin Classics / UP Press"
              className={FIELD_INPUT}
            />
          </div>

          <div>
            <label className={FIELD_LABEL}>
              <span>Source of Fund</span>
            </label>
            <input
              value={sourceOfFund}
              onChange={(e) => setSourceOfFund(e.target.value)}
              placeholder="e.g. City Government Fund / Donation"
              className={FIELD_INPUT}
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: PHYSICAL INVENTORY & ACCESSION GENERATOR */}
      <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-4 space-y-3.5">
        <div className="flex items-center justify-between border-b border-white/8 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-accent2/30 bg-accent2/12 text-accent2">
              <Layers className="h-3.5 w-3.5" />
            </span>
            <div>
              <h3 className="text-xs font-bold tracking-tight text-white">
                Physical Copies &amp; Accession Barcodes
              </h3>
              <p className="text-[0.68rem] text-tl/65">
                Assigns a unique Accession ID to every physical copy for independent condition tracking
              </p>
            </div>
          </div>
          <span className="rounded-full border border-accent2/30 bg-accent2/12 px-2.5 py-0.5 font-mono text-[0.64rem] font-bold text-accent2">
            {copiesToAdd} {copiesToAdd === 1 ? "copy" : "copies"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className={FIELD_LABEL}>
              <span>Call / Catalog Code</span>
            </label>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tl/45" />
              <input
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                placeholder="QA76.73"
                className={`${FIELD_INPUT} pl-7 font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={FIELD_LABEL}>
              <span>Accession Prefix</span>
            </label>
            <input
              value={accessionPrefix}
              onChange={(e) => setAccessionPrefix(e.target.value)}
              placeholder={previewPrefix}
              className={`${FIELD_INPUT} font-mono uppercase`}
            />
          </div>

          <div>
            <label className={FIELD_LABEL}>
              <span>Copies to Add *</span>
            </label>
            <div className="flex items-center rounded-xl border border-white/12 bg-bg1/85 px-1">
              <button
                type="button"
                onClick={() => setCopiesToAdd((c) => Math.max(1, c - 1))}
                aria-label="Decrease copy count"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-tl/70 transition hover:bg-white/8 hover:text-white cursor-pointer"
              >
                <Minus className="h-3 w-3" />
              </button>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={copiesToAdd}
                onChange={(e) =>
                  setCopiesToAdd(Math.max(1, Math.min(500, Number(e.target.value) || 1)))
                }
                className="w-full bg-transparent py-1.5 text-center font-mono text-xs font-bold text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCopiesToAdd((c) => Math.min(500, c + 1))}
                aria-label="Increase copy count"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-tl/70 transition hover:bg-white/8 hover:text-white cursor-pointer"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div>
            <label className={FIELD_LABEL}>
              <span>Shelf Location</span>
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tl/45" />
              <input
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                placeholder="A-Row 2"
                className={`${FIELD_INPUT} pl-7`}
              />
            </div>
          </div>
        </div>

        {/* Deterministic Accession Preview Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-bg1/75 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-tl/70">
              Generated Copy IDs:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {sampleTags.map((tag, i) =>
                tag === "…" ? (
                  <span key={i} className="px-1 font-mono text-xs text-tl/50">
                    …
                  </span>
                ) : (
                  <span
                    key={i}
                    className="rounded-md border border-accent/30 bg-accent/12 px-2 py-0.5 font-mono text-[0.7rem] font-bold text-accent"
                  >
                    {tag}
                  </span>
                )
              )}
            </div>
          </div>
          <span className="font-mono text-[0.66rem] text-accent2">
            Initial state: Good · Available
          </span>
        </div>
      </div>

      {/* FOOTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3.5">
        <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-tl transition hover:border-white/20 cursor-pointer">
          <input
            type="checkbox"
            checked={isBorrowable}
            onChange={(e) => setIsBorrowable(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent2)]"
          />
          <span className="font-medium text-white">Available for Patron Borrowing</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[0.62rem] font-bold ${
              isBorrowable
                ? "bg-accent2/15 text-accent2"
                : "bg-warn/15 text-warn"
            }`}
          >
            {isBorrowable ? "Circulating" : "Room-Use Only"}
          </span>
        </label>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" size="sm" disabled={saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookCheck className="h-3.5 w-3.5" />
            )}
            {saving
              ? "Cataloging..."
              : `Catalog & Save ${copiesToAdd} ${copiesToAdd === 1 ? "Copy" : "Copies"}`}
          </Button>
        </div>
      </div>
    </form>
  );
}
