import { toManilaDateKey } from "@/lib/errors";

export const CIRCULATION_RULES = {
  MAX_ACTIVE_BORROWS: 5,
  DEFAULT_LOAN_DAYS: 7,
  MAX_LOAN_DAYS: 14,
  MAX_RENEWALS: 2,
  RENEWAL_EXTENSION_DAYS: 7,
  GRACE_PERIOD_DAYS: 0,
  DAILY_OVERDUE_FINE_PHP: 5,
  DAMAGED_FEE_PHP: 150,
  LOST_FEE_PHP: 500,
  BLOCKING_UNPAID_FINE_PHP: 1,
  MAX_CSV_EXPORT_ROWS: 5000,
} as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getManilaTodayISO(now: Date = new Date()): string {
  return toManilaDateKey(now);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms);
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

/**
 * Computes overdue days after applying the grace period in Asia/Manila time.
 */
export function computeOverdueDays(
  dueDateIso: string | null | undefined,
  referenceDateIso: string = getManilaTodayISO()
): number {
  const due = String(dueDateIso ?? "").trim();
  if (!due || !isIsoDate(due) || !isIsoDate(referenceDateIso)) return 0;
  const rawLate = diffIsoDays(referenceDateIso, due);
  return Math.max(0, rawLate - CIRCULATION_RULES.GRACE_PERIOD_DAYS);
}

/**
 * Computes overdue fine on the server. Never trust client-supplied fines.
 */
export function computeOverdueFine(overdueDays: number): number {
  const safeDays = Math.max(0, Math.trunc(overdueDays));
  return Number((safeDays * CIRCULATION_RULES.DAILY_OVERDUE_FINE_PHP).toFixed(2));
}

/**
 * Computes replacement / damage fee on the server.
 */
export function computeIncidentFee(
  kind: "lost" | "damaged",
  bookCostPrice?: number | null
): number {
  if (kind === "lost") {
    const cost = Number(bookCostPrice ?? 0);
    if (Number.isFinite(cost) && cost > 0) {
      return Number(Math.max(cost, CIRCULATION_RULES.LOST_FEE_PHP).toFixed(2));
    }
    return CIRCULATION_RULES.LOST_FEE_PHP;
  }
  return CIRCULATION_RULES.DAMAGED_FEE_PHP;
}

export function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? "");
  // Neutralize spreadsheet formula injection
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
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
