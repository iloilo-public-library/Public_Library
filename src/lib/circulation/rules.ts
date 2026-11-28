import { toManilaDateKey } from "@/lib/errors";
import { CIRCULATION_POLICY } from "./policy";

export const CIRCULATION_RULES = CIRCULATION_POLICY;
export { CIRCULATION_POLICY };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getManilaTodayISO(now: Date = new Date()): string {
  return toManilaDateKey(now);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms);
}

const MONTH_INDEX_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function formatYmd(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parses `valid_until` values (ISO YYYY-MM-DD, YYYY/MM/DD, or en-PH/US locale
 * strings such as "January 1, 2020" / "1 January 2020") into an ISO YYYY-MM-DD
 * string. Returns null for empty values or non-date text (e.g. "Until Retirement").
 */
export function parseCardValidUntilToManilaIso(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  if (isIsoDate(s)) return s;

  const isoPrefix = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoPrefix) {
    return formatYmd(Number(isoPrefix[1]), Number(isoPrefix[2]), Number(isoPrefix[3]));
  }

  const mdyText = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdyText) {
    const month = MONTH_INDEX_MAP[mdyText[1].toLowerCase()];
    if (month) return formatYmd(Number(mdyText[3]), month, Number(mdyText[2]));
  }

  const dmyText = s.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (dmyText) {
    const month = MONTH_INDEX_MAP[dmyText[2].toLowerCase()];
    if (month) return formatYmd(Number(dmyText[3]), month, Number(dmyText[1]));
  }

  const mdySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdySlash) {
    return formatYmd(Number(mdySlash[3]), Number(mdySlash[1]), Number(mdySlash[2]));
  }

  return null;
}

/**
 * Returns true if `validUntil` represents a calendar date strictly before `todayIso`.
 * Non-date strings (e.g. LGU "Until Retirement") return false.
 */
export function isCardExpired(
  validUntil: unknown,
  todayIso: string = getManilaTodayISO()
): boolean {
  const parsedIso = parseCardValidUntilToManilaIso(validUntil);
  if (!parsedIso || !isIsoDate(todayIso)) return false;
  return parsedIso < todayIso;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const baseMs = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(baseMs)) return isoDate;
  const next = new Date(baseMs + days * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

export function diffIsoDays(laterIso: string, earlierIso: string): number {
  const laterMs = Date.parse(`${laterIso}T00:00:00Z`);
  const earlierMs = Date.parse(`${earlierIso}T00:00:00Z`);
  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) return 0;
  return Math.floor((laterMs - earlierMs) / (24 * 60 * 60 * 1000));
}

/**
 * Validates or computes a due date in Asia/Manila time.
 * Rejects due dates in the past or beyond MAX_LOAN_DAYS from date_issued.
 */
export function validateAndResolveDueDate(
  rawDateReturn: string | null | undefined,
  dateIssuedIso: string,
  todayIso: string = getManilaTodayISO()
): { ok: true; dateReturn: string } | { ok: false; error: string } {
  const trimmed = String(rawDateReturn ?? "").trim();
  if (!trimmed) {
    const base = isIsoDate(dateIssuedIso) ? dateIssuedIso : todayIso;
    return {
      ok: true,
      dateReturn: addDaysToIsoDate(base, CIRCULATION_RULES.DEFAULT_LOAN_DAYS),
    };
  }

  if (!isIsoDate(trimmed)) {
    return { ok: false, error: "Due date must be a valid YYYY-MM-DD date." };
  }

  if (trimmed < todayIso) {
    return { ok: false, error: "Due date cannot be in the past." };
  }

  const baseIssued = isIsoDate(dateIssuedIso) ? dateIssuedIso : todayIso;
  if (trimmed < baseIssued) {
    return { ok: false, error: "Due date cannot be earlier than the issue date." };
  }

  const spanDays = diffIsoDays(trimmed, baseIssued);
  if (spanDays > CIRCULATION_RULES.MAX_LOAN_DAYS) {
    return {
      ok: false,
      error: `Due date cannot exceed the maximum loan period of ${CIRCULATION_RULES.MAX_LOAN_DAYS} days.`,
    };
  }

  return { ok: true, dateReturn: trimmed };
}

type HolidayCollection = ReadonlySet<string> | readonly string[];

function toHolidaySet(holidays?: HolidayCollection): ReadonlySet<string> {
  if (!holidays) return new Set<string>();
  if ("has" in holidays && typeof holidays.has === "function") {
    return holidays;
  }
  const normalized = new Set<string>();
  for (const item of holidays as readonly string[]) {
    const iso = String(item ?? "").trim().slice(0, 10);
    if (iso) normalized.add(iso);
  }
  return normalized;
}

/**
 * Returns true if the given YYYY-MM-DD date in Asia/Manila is a Sunday
 * or appears in the library holidays collection.
 * Library operating days are Monday through Saturday (inclusive).
 */
export function isLibraryClosedDay(
  isoDate: string,
  holidays?: HolidayCollection
): boolean {
  const trimmed = String(isoDate ?? "").trim();
  if (!trimmed || !isIsoDate(trimmed)) return false;
  const ms = Date.parse(`${trimmed}T00:00:00Z`);
  if (!Number.isFinite(ms)) return false;
  const dow = new Date(ms).getUTCDay();
  if (dow === 0) return true;
  const holidaySet = toHolidaySet(holidays);
  return holidaySet.has(trimmed);
}

/**
 * If dueDateIso falls on a closed day (Sunday or holiday), advances day-by-day
 * to the next open Monday-Saturday non-holiday date. Preserves empty/invalid input safely.
 */
export function resolveEffectiveDueDate(
  dueDateIso: string,
  holidays?: HolidayCollection
): string {
  const trimmed = String(dueDateIso ?? "").trim();
  if (!trimmed || !isIsoDate(trimmed)) return trimmed;
  const holidaySet = toHolidaySet(holidays);
  let current = trimmed;
  for (let i = 0; i < 366; i++) {
    if (!isLibraryClosedDay(current, holidaySet)) {
      return current;
    }
    current = addDaysToIsoDate(current, 1);
  }
  return current;
}

function countWorkingDaysBetween(
  earlierIso: string,
  laterIso: string,
  holidays?: HolidayCollection
): number {
  const startMs = Date.parse(`${earlierIso}T00:00:00Z`);
  const endMs = Date.parse(`${laterIso}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  const holidaySet = toHolidaySet(holidays);
  let working = 0;
  const dayMs = 24 * 60 * 60 * 1000;
  for (let t = startMs + dayMs; t <= endMs; t += dayMs) {
    const dt = new Date(t);
    const dow = dt.getUTCDay();
    if (dow === 0) continue;
    const iso = dt.toISOString().slice(0, 10);
    if (holidaySet.has(iso)) continue;
    working++;
  }
  return working;
}

/**
 * Computes overdue days after applying the grace period in Asia/Manila time,
 * respecting CIRCULATION_RULES.FINE_DAY_MODE ("calendar" or "working").
 * In "working" mode, Mondays-Saturdays excluding Sundays and holidays count,
 * and due dates falling on closed days shift to the next open working day.
 */
export function computeOverdueDays(
  dueDateIso: string | null | undefined,
  referenceDateIso: string = getManilaTodayISO(),
  holidays?: HolidayCollection
): number {
  const due = String(dueDateIso ?? "").trim();
  if (!due || !isIsoDate(due) || !isIsoDate(referenceDateIso)) return 0;
  if (CIRCULATION_RULES.FINE_DAY_MODE === "working") {
    const effectiveDue = resolveEffectiveDueDate(due, holidays);
    if (referenceDateIso <= effectiveDue) return 0;
    const rawLate = countWorkingDaysBetween(effectiveDue, referenceDateIso, holidays);
    return Math.max(0, rawLate - CIRCULATION_RULES.GRACE_PERIOD_DAYS);
  }
  const rawLate = diffIsoDays(referenceDateIso, due);
  return Math.max(0, rawLate - CIRCULATION_RULES.GRACE_PERIOD_DAYS);
}

/**
 * Computes overdue fine on the server using a single shared formula
 * (overdueDays * DAILY_OVERDUE_FINE_PHP * quantity) with no cap.
 * Never trust client-supplied fines.
 */
export function computeOverdueFine(overdueDays: number, quantity: number = 1): number {
  const safeDays = Math.max(0, Math.trunc(overdueDays));
  const safeQty = Math.max(1, Math.trunc(Number(quantity) || 1));
  return Number((safeDays * CIRCULATION_RULES.DAILY_OVERDUE_FINE_PHP * safeQty).toFixed(2));
}

const REFERENCE_SECTION_RE = /\b(general\s+)?reference(\s+section)?\b/i;

/**
 * Returns true if the book is non-borrowable or belongs to the Reference / General Reference section.
 */
export function isReferenceSectionBook(book: {
  is_borrowable?: unknown;
  category?: unknown;
  class?: unknown;
  shelf_location?: unknown;
}): boolean {
  if (!book) return false;
  if (book.is_borrowable === false) return true;
  return [book.category, book.class, book.shelf_location].some((val) =>
    REFERENCE_SECTION_RE.test(String(val ?? ""))
  );
}

export function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? "");
  // Neutralize spreadsheet formula injection including leading tab/CR/whitespace
  const safe = /^(?:[\t\r\n ]*[=+\-@]|[\t\r])/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildBorrowHistoryCsv(
  rows: Array<Record<string, unknown>>,
  options: { isLibrarian?: boolean; resource?: "library_cards" | "returns" } = {}
): string {
  const capped = rows.slice(0, CIRCULATION_RULES.MAX_CSV_EXPORT_ROWS);
  if (options.resource === "returns") {
    const headers = [
      "Return ID",
      "Card ID",
      "Borrower",
      "Category",
      "Book Title",
      "ISBN",
      "Qty Returned",
      "Date Issued",
      "Return Date",
      "Overdue Days",
      "Fine (PHP)",
      "Processed By",
    ];
    const lines = [headers.join(",")];
    for (const r of capped) {
      lines.push(
        [
          r.return_id,
          r.card_id,
          r.borrower_name,
          r.card_category,
          r.book_title,
          r.book_isbn,
          r.qty_returned,
          r.date_issued,
          r.return_date,
          r.overdue_days ?? 0,
          r.fine_amount ?? 0,
          r.processed_by_name,
        ]
          .map(escapeCsvCell)
          .join(",")
      );
    }
    return lines.join("\r\n");
  }

  const headers = [
    "Card ID",
    "Category",
    "Full Name",
    ...(options.isLibrarian ? [] : ["Phone", "Address"]),
    "Card Type",
    "Date Issued",
    "Due Date",
    "Valid Until",
    "Books Count",
    "Overdue Days",
    "Fine (PHP)",
    "Status",
  ];
  const lines = [headers.join(",")];
  for (const c of capped) {
    lines.push(
      [
        c.id,
        c.card_type_category,
        c.fullname,
        ...(options.isLibrarian ? [] : [c.phone_number, c.address]),
        c.card_type,
        c.date_issued,
        c.date_return,
        c.valid_until,
        c.books_count,
        c.overdue_days ?? 0,
        c.fine_amount ?? 0,
        c.status ?? "active",
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }
  return lines.join("\r\n");
}
