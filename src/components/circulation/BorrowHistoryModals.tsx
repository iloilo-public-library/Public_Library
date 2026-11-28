"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  ArrowDownLeft,
  Banknote,
  BookOpen,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Search,
  ShieldAlert,
  Trash2,
  User,
  X,
} from "lucide-react";
import { swrPrivateConfig } from "@/lib/api";
import {
  CIRCULATION_POLICY,
  type CatalogBook,
  type LibraryCardRow,
  type ReturnItemRow,
  computeAutoValidUntil,
  formatCardTypeLabel,
  formatPhp,
  getManilaTodayISO,
} from "./types";

function useDialogTrap(open: boolean, onClose: () => void, busy: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ onClose, busy });
  stateRef.current = { onClose, busy };

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !stateRef.current.busy) {
        e.preventDefault();
        stateRef.current.onClose();
        return;
      }
      if (e.key === "Tab" && ref.current) {
        const els = ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open]);

  return ref;
}

export function CardDetailModal({
  card,
  role = "admin",
  onClose,
}: {
  card: LibraryCardRow | null;
  role?: "admin" | "librarian";
  onClose: () => void;
}) {
  const ref = useDialogTrap(Boolean(card), onClose, false);
  if (!card) return null;
  const books = card.books ?? [];
  const totalVols = books.reduce((s, b) => s + Number(b.quantity ?? 1), 0);
  const hidePatronContacts = role === "librarian";
  const fineVal = Number(card.fine_amount ?? 0);

  return (
    <div
      className="circ-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="circ-modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        tabIndex={-1}
      >
        <div className="circ-modal-hdr">
          <h2 id="cd-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Eye className="h-4 w-4" style={{ color: "var(--circ-accent)" }} aria-hidden="true" />
            Card Details
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} aria-label="Close card details">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="circ-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="circ-badge" style={{ background: "rgba(159, 193, 225, 0.14)", color: "var(--circ-accent)" }}>
              {card.card_type_category === "member" ? "Member" : "Borrower"}
            </span>
            <span style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono), monospace", opacity: 0.75 }}>
              Card #{card.id}
            </span>
            <span
              className="circ-badge"
              style={
                card.status === "returned"
                  ? { background: "rgba(72, 199, 142, 0.14)", color: "var(--circ-accent2)" }
                  : card.status === "overdue" || card.status === "lost"
                    ? { background: "rgba(255, 99, 99, 0.14)", color: "var(--circ-danger)" }
                    : { background: "rgba(159, 193, 225, 0.14)", color: "var(--circ-accent)" }
              }
            >
              {card.status ? card.status.toUpperCase() : "ACTIVE"}
              {card.overdue_days && card.overdue_days > 0 ? ` (${card.overdue_days}d overdue)` : ""}
            </span>
            {totalVols > 0 && (
              <span className="circ-badge" style={{ background: "rgba(72, 199, 142, 0.14)", color: "var(--circ-accent2)" }}>
                {totalVols} vol{totalVols === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--circ-border)",
            }}
          >
            {card.photo_url ? (
              <img
                src={card.photo_url}
                alt={`${card.fullname} 1x1 card photo`}
                style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <User className="h-7 w-7 opacity-60 shrink-0" aria-hidden="true" />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>{card.fullname}</div>
              {hidePatronContacts ? (
                <div style={{ fontSize: "0.76rem", opacity: 0.7 }}>
                  {card.card_type_category === "member" ? "Registered Member" : "Walk-In Borrower"} · Contact details hidden for librarian role
                </div>
              ) : (
                <>
                  <div style={{ fontSize: "0.78rem", opacity: 0.78 }}>{card.phone_number || "—"}</div>
                  <div style={{ fontSize: "0.78rem", opacity: 0.78 }}>{card.address || "—"}</div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: "0.82rem" }}>
            <div><strong>Date Issued:</strong> {card.date_issued || "—"}</div>
            <div><strong>Due Date:</strong> {card.date_return || "—"}</div>
            <div><strong>Card Type:</strong> {formatCardTypeLabel(card.card_type)}</div>
            <div><strong>Valid Until:</strong> {card.valid_until || "—"}</div>
            <div><strong>Registered By:</strong> {card.registered_by_name || "—"}</div>
            <div>
              <strong>Fine Balance:</strong>{" "}
              {card.fine_waived ? "Waived" : fineVal > 0 ? formatPhp(fineVal) : "₱0.00"}
            </div>
            {card.renewal1_checked && <div><strong>1st Renewal:</strong> {card.renewal1_date || "Yes"}</div>}
            {card.renewal2_checked && <div><strong>2nd Renewal:</strong> {card.renewal2_date || "Yes"}</div>}
          </div>

          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", opacity: 0.65, marginBottom: 8 }}>
              Books on Card ({books.length})
            </div>
            {books.length === 0 ? (
              <div style={{ fontSize: "0.82rem", opacity: 0.6 }}>No books recorded.</div>
            ) : (
              books.map((b, i) => (
                <div
                  key={b.id ?? i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "rgba(72, 199, 142, 0.08)",
                    border: "1px solid rgba(72, 199, 142, 0.2)",
                    marginBottom: 7,
                    fontSize: "0.83rem",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{b.book_title}</div>
                    <div style={{ fontSize: "0.74rem", opacity: 0.78 }}>
                      {b.book_id ? `Book ID #${b.book_id}` : ""}
                      {b.copy_id ? ` · Copy #${b.copy_id}` : ""} · by {b.book_author}
                      {b.loan_status ? ` · Status: ${b.loan_status}` : ""}
                      {Number(b.fine_amount ?? 0) > 0 && !b.fine_waived && !b.fine_paid
                        ? ` · Fine: ${formatPhp(b.fine_amount)}`
                        : b.fine_waived
                          ? " · Waived"
                          : ""}
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--circ-accent2)", flexShrink: 0 }}>
                    ×{b.quantity ?? 1}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="circ-modal-foot">
          <button type="button" className="circ-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ProcessReturnPayload {
  items: Array<{
    card_book_id: number;
    qty_returned: number;
    return_condition: "Good" | "Fair" | "Damaged" | "Destroyed" | "Lost";
    condition_notes?: string;
  }>;
  return_date?: string;
  backdate_reason?: string;
}

interface ReturnDraftRow {
  card_book_id: number;
  book_title: string;
  book_author: string;
  max_qty: number;
  qty_returned: number;
  return_condition: "Good" | "Fair" | "Damaged" | "Destroyed" | "Lost";
  condition_notes: string;
}

export function ProcessReturnModal({
  card,
  role = "admin",
  busy,
  onClose,
  onConfirm,
}: {
  card: LibraryCardRow | null;
  role?: "admin" | "librarian";
  busy: boolean;
  onClose: () => void;
  onConfirm: (card: LibraryCardRow, payload: ProcessReturnPayload) => Promise<void>;
}) {
  const todayISO = getManilaTodayISO();
  const isAdmin = role === "admin";
  const [rows, setRows] = useState<ReturnDraftRow[]>([]);
  const [adminBackdate, setAdminBackdate] = useState(false);
  const [backdateReturnDate, setBackdateReturnDate] = useState(todayISO);
  const [backdateReason, setBackdateReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const ref = useDialogTrap(Boolean(card), onClose, busy);

  const cardId = card?.id ?? null;

  useEffect(() => {
    if (!card) return;
    const activeBooks = (card.books ?? []).filter((b) => {
      const ls = String(b.loan_status ?? "borrowed");
      return ls === "borrowed" || ls === "overdue";
    });
    const source = activeBooks.length > 0 ? activeBooks : card.is_returned ? [] : (card.books ?? []);
    setRows(
      source.map((b) => ({
        card_book_id: Number(b.id),
        book_title: b.book_title,
        book_author: b.book_author,
        max_qty: Math.max(1, Number(b.quantity ?? 1)),
        qty_returned: Math.max(1, Number(b.quantity ?? 1)),
        return_condition: "Good",
        condition_notes: "",
      }))
    );
    setAdminBackdate(false);
    setBackdateReturnDate(getManilaTodayISO());
    setBackdateReason("");
    setLocalError(null);
  }, [cardId, card]);

  if (!card) return null;

  const totalReturning = rows.reduce((s, r) => s + r.qty_returned, 0);
  const hasIncidentCondition = rows.some(
    (r) =>
      r.qty_returned > 0 &&
      (r.return_condition === "Damaged" ||
        r.return_condition === "Destroyed" ||
        r.return_condition === "Lost")
  );

  const handleSubmit = async () => {
    setLocalError(null);
    const items = rows
      .filter((r) => r.qty_returned > 0)
      .map((r) => ({
        card_book_id: r.card_book_id,
        qty_returned: r.qty_returned,
        return_condition: r.return_condition,
        ...(r.condition_notes.trim() ? { condition_notes: r.condition_notes.trim() } : {}),
      }));

    if (items.length === 0) {
      setLocalError("Set a return quantity of at least 1 book before confirming.");
      return;
    }

    const payload: ProcessReturnPayload = { items };
    if (isAdmin && adminBackdate) {
      if (!backdateReturnDate || backdateReturnDate > todayISO) {
        setLocalError("Backdate return date must be today or earlier.");
        return;
      }
      if (backdateReason.trim().length < 3) {
        setLocalError("Admin backdating requires a reason (at least 3 characters).");
        return;
      }
      payload.return_date = backdateReturnDate;
      payload.backdate_reason = backdateReason.trim();
    }

    await onConfirm(card, payload);
  };

  return (
    <div
      className="circ-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        className="circ-modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pr-title"
        tabIndex={-1}
      >
        <div className="circ-modal-hdr">
          <h2 id="pr-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--circ-warn)", display: "flex", alignItems: "center", gap: 8 }}>
            <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
            Process Book Return
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} disabled={busy} aria-label="Close return modal">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="circ-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: "0.86rem" }}>
            Process return for <strong>{card.fullname}</strong> (Card #{card.id}). Returning{" "}
            <strong>{totalReturning}</strong> volume{totalReturning === 1 ? "" : "s"}.
          </div>

          <div
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              border: "1px solid var(--circ-border)",
              background: "rgba(159, 193, 225, 0.06)",
              fontSize: "0.78rem",
            }}
          >
            <strong>Return Date:</strong> {isAdmin && adminBackdate ? backdateReturnDate : `${todayISO} (Server, Asia/Manila)`}
          </div>

          {isAdmin && (
            <div style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--circ-border)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={adminBackdate}
                  disabled={busy}
                  onChange={(e) => setAdminBackdate(e.target.checked)}
                />
                Admin Backdate Return (requires reason)
              </label>
              {adminBackdate && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8, marginTop: 8 }}>
                  <input
                    type="date"
                    max={todayISO}
                    value={backdateReturnDate}
                    disabled={busy}
                    onChange={(e) => setBackdateReturnDate(e.target.value)}
                    aria-label="Backdated return date"
                    style={{ minHeight: 38, borderRadius: 8, padding: "4px 8px", border: "1px solid var(--circ-border)", background: "var(--circ-input-bg)", color: "var(--circ-text)" }}
                  />
                  <input
                    type="text"
                    value={backdateReason}
                    disabled={busy}
                    onChange={(e) => setBackdateReason(e.target.value)}
                    placeholder="Backdate reason (min 3 chars)"
                    aria-label="Backdate reason"
                    style={{ minHeight: 38, borderRadius: 8, padding: "4px 10px", border: "1px solid var(--circ-border)", background: "var(--circ-input-bg)", color: "var(--circ-text)" }}
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", opacity: 0.65, marginBottom: 8 }}>
              Active Books ({rows.length})
            </div>
            {rows.length === 0 ? (
              <div style={{ fontSize: "0.82rem", opacity: 0.65 }}>No active borrowed books remain on this card.</div>
            ) : (
              rows.map((r, idx) => (
                <div
                  key={r.card_book_id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255, 152, 0, 0.08)",
                    border: "1px solid rgba(255, 152, 0, 0.22)",
                    marginBottom: 8,
                    fontSize: "0.82rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.book_title}</div>
                    <div style={{ fontSize: "0.73rem", opacity: 0.78 }}>
                      by {r.book_author} · Remaining Qty: {r.max_qty}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "82px 1fr", gap: 8 }}>
                    <div>
                      <label htmlFor={`pr-qty-${r.card_book_id}`} style={{ display: "block", fontSize: "0.7rem", marginBottom: 3 }}>
                        Qty (0–{r.max_qty})
                      </label>
                      <input
                        id={`pr-qty-${r.card_book_id}`}
                        type="number"
                        min={0}
                        max={r.max_qty}
                        value={r.qty_returned}
                        disabled={busy}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(r.max_qty, Math.trunc(Number(e.target.value) || 0)));
                          setRows((prev) => prev.map((it, i) => (i === idx ? { ...it, qty_returned: v } : it)));
                        }}
                        style={{ width: "100%", minHeight: 36, borderRadius: 8, padding: "4px 8px", border: "1px solid var(--circ-border)", background: "var(--circ-input-bg)", color: "var(--circ-text)" }}
                      />
                    </div>
                    <div>
                      <label htmlFor={`pr-cond-${r.card_book_id}`} style={{ display: "block", fontSize: "0.7rem", marginBottom: 3 }}>
                        Condition
                      </label>
                      <select
                        id={`pr-cond-${r.card_book_id}`}
                        value={r.return_condition}
                        disabled={busy}
                        onChange={(e) => {
                          const val = e.target.value as ReturnDraftRow["return_condition"];
                          setRows((prev) => prev.map((it, i) => (i === idx ? { ...it, return_condition: val } : it)));
                        }}
                        style={{ width: "100%", minHeight: 36, borderRadius: 8, padding: "4px 8px", border: "1px solid var(--circ-border)", background: "var(--circ-input-bg)", color: "var(--circ-text)" }}
                      >
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                        <option value="Damaged">Damaged</option>
                        <option value="Destroyed">Destroyed</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={r.condition_notes}
                    disabled={busy}
                    placeholder="Condition notes (optional)"
                    aria-label={`Condition notes for ${r.book_title}`}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRows((prev) => prev.map((it, i) => (i === idx ? { ...it, condition_notes: val } : it)));
                    }}
                    style={{ width: "100%", minHeight: 34, borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", border: "1px solid var(--circ-border)", background: "var(--circ-input-bg)", color: "var(--circ-text)" }}
                  />
                </div>
              ))
            )}
          </div>

          {hasIncidentCondition && (
            <div
              role="note"
              style={{
                padding: "9px 12px",
                borderRadius: 10,
                background: "rgba(255, 99, 99, 0.12)",
                border: "1px solid rgba(255, 99, 99, 0.3)",
                fontSize: "0.78rem",
                color: "var(--circ-danger)",
              }}
            >
              Damaged/Destroyed/Lost condition selected: marked for City Librarian replacement assessment (copy replacement, assessed equivalent payment, or Affidavit of Loss).
            </div>
          )}

          {localError && (
            <div role="alert" style={{ fontSize: "0.8rem", color: "var(--circ-danger)", fontWeight: 600 }}>
              {localError}
            </div>
          )}
        </div>

        <div className="circ-modal-foot">
          <button type="button" className="circ-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="circ-btn warn"
            disabled={busy || rows.length === 0 || totalReturning === 0}
            onClick={handleSubmit}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Processing…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Confirm Return
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface EditCardPayload {
  firstname: string;
  lastname: string;
  phone_number?: string;
  address?: string;
  card_type: string;
  valid_until: string;
  book_ids?: Array<{ book_id: number; copy_id?: number; qty: number }>;
}

interface EditableBookDraft {
  key: string;
  book_id: number | null;
  copy_id?: number | null;
  title: string;
  author: string;
  quantity: number;
}

export function EditCardModal({
  card,
  role = "admin",
  busy,
  onClose,
  onSave,
  onRequestRenew,
}: {
  card: LibraryCardRow | null;
  role?: "admin" | "librarian";
  busy: boolean;
  onClose: () => void;
  onSave: (card: LibraryCardRow, payload: EditCardPayload) => Promise<void>;
  onRequestRenew?: (card: LibraryCardRow) => void;
}) {
  const isLibrarian = role === "librarian";
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [cardType, setCardType] = useState("regular");
  const [validUntil, setValidUntil] = useState("");
  const [booksDraft, setBooksDraft] = useState<EditableBookDraft[]>([]);
  const [booksModified, setBooksModified] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const ref = useDialogTrap(Boolean(card), onClose, busy);

  const cardId = card?.id ?? null;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(bookSearch.trim()), 250);
    return () => window.clearTimeout(t);
  }, [bookSearch]);

  const { data: bookSearchData, isLoading: searchingBooks } = useSWR<{ rows?: CatalogBook[] }>(
    card && debouncedQ.length > 0
      ? `/api/admin/data?resource=books&pageSize=15&q=${encodeURIComponent(debouncedQ)}`
      : null,
    swrPrivateConfig
  );

  useEffect(() => {
    if (!card) return;
    setFirstname(card.firstname || "");
    setLastname(card.lastname || "");
    setPhoneNumber(card.phone_number || "");
    setAddress(card.address || "");
    setCardType(card.card_type || "regular");
    setValidUntil(card.valid_until || computeAutoValidUntil(card.card_type));
    setBooksDraft(
      (card.books ?? []).map((b, i) => ({
        key: `${b.id ?? i}-${b.book_id ?? "legacy"}`,
        book_id: b.book_id,
        copy_id: b.copy_id ?? null,
        title: b.book_title,
        author: b.book_author,
        quantity: Math.max(1, Number(b.quantity ?? 1)),
      }))
    );
    setBooksModified(false);
    setBookSearch("");
    setLocalError(null);
  }, [cardId, card]);

  const searchResults = useMemo(() => bookSearchData?.rows ?? [], [bookSearchData?.rows]);

  if (!card) return null;

  const isClosed = Boolean(card.is_returned || card.status === "returned" || card.status === "lost");
  const renewalsUsed = (card.renewal1_checked ? 1 : 0) + (card.renewal2_checked ? 1 : 0);
  const totalQty = booksDraft.reduce((s, b) => s + b.quantity, 0);

  const handleAddBook = (b: CatalogBook) => {
    if (totalQty + 1 > CIRCULATION_POLICY.MAX_ACTIVE_BORROWS) {
      setLocalError(`Maximum ${CIRCULATION_POLICY.MAX_ACTIVE_BORROWS} books per card.`);
      return;
    }
    setLocalError(null);
    setBooksModified(true);
    setBooksDraft((prev) => {
      const idx = prev.findIndex((item) => item.book_id === b.id && !item.copy_id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          key: `add-${b.id}-${Date.now()}`,
          book_id: b.id,
          copy_id: null,
          title: b.title,
          author: b.author,
          quantity: 1,
        },
      ];
    });
    setBookSearch("");
  };

  const handleSubmit = async () => {
    setLocalError(null);
    if (!firstname.trim() || !lastname.trim()) {
      setLocalError("First name and last name are required.");
      return;
    }
    if (booksModified && booksDraft.length === 0) {
      setLocalError("Card must have at least one borrowed book.");
      return;
    }
    const payload: EditCardPayload = {
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      card_type: cardType,
      valid_until: validUntil.trim(),
    };
    if (!isLibrarian) {
      payload.phone_number = phoneNumber.trim();
      payload.address = address.trim();
    }
    if (booksModified) {
      const validBookItems = booksDraft
        .filter((b): b is EditableBookDraft & { book_id: number } => typeof b.book_id === "number" && b.book_id > 0)
        .map((b) =>
          b.copy_id
            ? { book_id: b.book_id, copy_id: Number(b.copy_id), qty: 1 }
            : { book_id: b.book_id, qty: b.quantity }
        );
      if (validBookItems.length === 0) {
        setLocalError("At least one valid catalog book is required.");
        return;
      }
      payload.book_ids = validBookItems;
    }
    await onSave(card, payload);
  };

  return (
    <div
      className="circ-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        className="circ-modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ec-title"
        tabIndex={-1}
      >
        <div className="circ-modal-hdr">
          <h2 id="ec-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Pencil className="h-4 w-4" style={{ color: "var(--circ-accent)" }} aria-hidden="true" />
            Edit Library Card — {card.fullname}
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} disabled={busy} aria-label="Close edit modal">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="circ-modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {isClosed && (
            <div
              role="status"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(255, 152, 0, 0.12)",
                border: "1px solid rgba(255, 152, 0, 0.32)",
                color: "var(--circ-warn)",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              This card is closed ({card.status || "returned"}) and is read-only.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="circ-fg" style={{ marginBottom: 0 }}>
              <label htmlFor="ec-fn">First Name *</label>
              <input
                id="ec-fn"
                type="text"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                disabled={busy || isClosed}
              />
            </div>
            <div className="circ-fg" style={{ marginBottom: 0 }}>
              <label htmlFor="ec-ln">Last Name *</label>
              <input
                id="ec-ln"
                type="text"
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                disabled={busy || isClosed}
              />
            </div>
          </div>

          {!isLibrarian && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="circ-fg" style={{ marginBottom: 0 }}>
                <label htmlFor="ec-phone">Phone Number</label>
                <input
                  id="ec-phone"
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={busy || isClosed}
                />
              </div>
              <div className="circ-fg" style={{ marginBottom: 0 }}>
                <label htmlFor="ec-addr">Address</label>
                <input
                  id="ec-addr"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={busy || isClosed}
                />
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="circ-fg" style={{ marginBottom: 0 }}>
              <label htmlFor="ec-ctype">Card Type</label>
              <select
                id="ec-ctype"
                value={cardType}
                onChange={(e) => {
                  const val = e.target.value;
                  setCardType(val);
                  setValidUntil(computeAutoValidUntil(val));
                }}
                disabled={busy || isClosed}
              >
                <option value="city_govt">Iloilo City Government (LGU)</option>
                <option value="regular">Regular / Student / Others</option>
              </select>
            </div>
            <div className="circ-fg" style={{ marginBottom: 0 }}>
              <label htmlFor="ec-valid">Valid Until</label>
              <input
                id="ec-valid"
                type="text"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                disabled={busy || isClosed}
              />
            </div>
          </div>

          {/* Borrowed Books List Editing */}
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", opacity: 0.65, marginBottom: 6 }}>
              Borrowed Books ({totalQty} / {CIRCULATION_POLICY.MAX_ACTIVE_BORROWS})
            </div>
            {!isClosed && (
              <div style={{ position: "relative", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, border: "1px solid var(--circ-border)", padding: "0 10px", background: "var(--circ-input-bg)" }}>
                  <Search className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                  <input
                    type="text"
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    disabled={busy}
                    placeholder="Add book to card (search title/ISBN)…"
                    aria-label="Add book to library card"
                    style={{ width: "100%", minHeight: 36, background: "transparent", border: "none", color: "var(--circ-text)", fontSize: "0.8rem", outline: "none" }}
                  />
                </div>
                {debouncedQ.length > 0 && (
                  <div className="circ-drop" style={{ maxHeight: 160 }}>
                    {searchingBooks ? (
                      <div style={{ padding: 10, fontSize: "0.78rem" }}>Searching…</div>
                    ) : searchResults.length === 0 ? (
                      <div style={{ padding: 10, fontSize: "0.78rem", opacity: 0.7 }}>No books found</div>
                    ) : (
                      searchResults.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="circ-drop-item"
                          disabled={(b.available_copies ?? 0) <= 0}
                          onClick={() => handleAddBook(b)}
                        >
                          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                            <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>{b.title}</div>
                            <div style={{ fontSize: "0.7rem", opacity: 0.7 }}>{b.author} · {b.available_copies} avail</div>
                          </div>
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {booksDraft.map((b, i) => (
                <div
                  key={b.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 9,
                    background: "rgba(72, 199, 142, 0.08)",
                    border: "1px solid rgba(72, 199, 142, 0.2)",
                    fontSize: "0.8rem",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{b.title}</div>
                    <div style={{ fontSize: "0.7rem", opacity: 0.72 }}>
                      by {b.author}{b.copy_id ? ` · Copy #${b.copy_id}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700 }}>×{b.quantity}</span>
                    {!isClosed && !b.copy_id && (
                      <input
                        type="number"
                        min={1}
                        max={CIRCULATION_POLICY.MAX_ACTIVE_BORROWS}
                        value={b.quantity}
                        disabled={busy}
                        aria-label={`Quantity for ${b.title}`}
                        onChange={(e) => {
                          const q = Math.max(1, Math.min(CIRCULATION_POLICY.MAX_ACTIVE_BORROWS, Math.trunc(Number(e.target.value) || 1)));
                          setBooksModified(true);
                          setBooksDraft((prev) => prev.map((it, idx) => (idx === i ? { ...it, quantity: q } : it)));
                        }}
                        style={{ width: 50, minHeight: 30, textAlign: "center", borderRadius: 6, border: "1px solid var(--circ-border)", background: "var(--circ-input-bg)", color: "var(--circ-text)" }}
                      />
                    )}
                    {!isClosed && (
                      <button
                        type="button"
                        className="circ-icon-btn del"
                        disabled={busy}
                        aria-label={`Remove ${b.title}`}
                        onClick={() => {
                          setBooksModified(true);
                          setBooksDraft((prev) => prev.filter((_, idx) => idx !== i));
                        }}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Read-only Renewal Summary + Dedicated Renew Button */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--circ-border)",
              background: "rgba(159, 193, 225, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              fontSize: "0.78rem",
            }}
          >
            <div>
              <strong>Due Date:</strong> {card.date_return || "—"} ·{" "}
              <strong>Renewals:</strong> {renewalsUsed} / {CIRCULATION_POLICY.MAX_RENEWALS}
              {card.renewal1_date ? ` (1st: ${card.renewal1_date})` : ""}
              {card.renewal2_date ? ` (2nd: ${card.renewal2_date})` : ""}
            </div>
            {!isClosed && onRequestRenew && renewalsUsed < CIRCULATION_POLICY.MAX_RENEWALS && (
              <button
                type="button"
                className="circ-btn"
                style={{ minHeight: 34, fontSize: "0.76rem" }}
                disabled={busy}
                onClick={() => {
                  onClose();
                  onRequestRenew(card);
                }}
              >
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Renew Loan
              </button>
            )}
          </div>

          {localError && (
            <div role="alert" style={{ fontSize: "0.8rem", color: "var(--circ-danger)", fontWeight: 600 }}>
              {localError}
            </div>
          )}
        </div>

        <div className="circ-modal-foot">
          <button type="button" className="circ-btn" onClick={onClose} disabled={busy}>
            {isClosed ? "Close" : "Cancel"}
          </button>
          {!isClosed && (
            <button
              type="button"
              className="circ-btn primary"
              disabled={busy}
              onClick={handleSubmit}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Save Changes
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RenewLoanModal({
  card,
  busy,
  onClose,
  onConfirm,
}: {
  card: LibraryCardRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (card: LibraryCardRow) => Promise<void>;
}) {
  const ref = useDialogTrap(Boolean(card), onClose, busy);
  if (!card) return null;
  const renewalsUsed = (card.renewal1_checked ? 1 : 0) + (card.renewal2_checked ? 1 : 0);

  return (
    <div
      className="circ-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        className="circ-modal-box sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rn-title"
        tabIndex={-1}
      >
        <div className="circ-modal-hdr">
          <h2 id="rn-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <RotateCw className="h-4 w-4" style={{ color: "var(--circ-accent)" }} aria-hidden="true" />
            Renew Loan
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} disabled={busy} aria-label="Close renew modal">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="circ-modal-body" style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.85rem" }}>
          <div>
            Confirm loan renewal for <strong>{card.fullname}</strong> (Card #{card.id})?
          </div>
          <div>
            <strong>Current Due Date:</strong> {card.date_return || "—"} ·{" "}
            <strong>Renewals Used:</strong> {renewalsUsed} / {CIRCULATION_POLICY.MAX_RENEWALS}
          </div>
          <div>
            <strong>Books:</strong>{" "}
            {(card.books ?? []).map((b) => b.book_title).join(", ") || "—"}
          </div>
          <div style={{ fontSize: "0.76rem", opacity: 0.78 }}>
            The server will verify card validity, unpaid fines, overdue status, and reservations, then extend the due date by {CIRCULATION_POLICY.RENEWAL_EXTENSION_DAYS} days (max {CIRCULATION_POLICY.MAX_LOAN_DAYS} days).
          </div>
        </div>

        <div className="circ-modal-foot">
          <button type="button" className="circ-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="circ-btn primary" disabled={busy} onClick={() => onConfirm(card)}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Renewing…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Confirm Renewal
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MarkIncidentModal({
  card,
  busy,
  onClose,
  onConfirm,
}: {
  card: LibraryCardRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (
    card: LibraryCardRow,
    payload: { kind: "damaged" | "lost"; card_book_id: number; reason: string; condition_notes?: string }
  ) => Promise<void>;
}) {
  const [kind, setKind] = useState<"damaged" | "lost">("damaged");
  const [selectedBookId, setSelectedBookId] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const ref = useDialogTrap(Boolean(card), onClose, busy);

  const cardId = card?.id ?? null;

  useEffect(() => {
    if (!card) return;
    const activeBooks = (card.books ?? []).filter((b) => {
      const ls = String(b.loan_status ?? "borrowed");
      return ls === "borrowed" || ls === "overdue";
    });
    setKind("damaged");
    setSelectedBookId(activeBooks[0]?.id ?? card.books[0]?.id ?? 0);
    setReason("");
    setNotes("");
    setLocalError(null);
  }, [cardId, card]);

  if (!card) return null;

  const activeBooks = (card.books ?? []).filter((b) => {
    const ls = String(b.loan_status ?? "borrowed");
    return ls === "borrowed" || ls === "overdue";
  });
  const chosenBook = activeBooks.find((b) => b.id === selectedBookId) ?? activeBooks[0];

  const handleSubmit = async () => {
    setLocalError(null);
    if (!chosenBook) {
      setLocalError("No active book available to report.");
      return;
    }
    if (reason.trim().length < 3) {
      setLocalError("Please enter a reason (at least 3 characters).");
      return;
    }
    await onConfirm(card, {
      kind,
      card_book_id: chosenBook.id,
      reason: reason.trim(),
      ...(notes.trim() ? { condition_notes: notes.trim() } : {}),
    });
  };

  return (
    <div
      className="circ-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        className="circ-modal-box sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mi-title"
        tabIndex={-1}
      >
        <div className="circ-modal-hdr">
          <h2 id="mi-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--circ-danger)", display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Report Damaged / Lost Book
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} disabled={busy} aria-label="Close incident modal">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="circ-modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: "0.84rem" }}>
            Member: <strong>{card.fullname}</strong> (Card #{card.id})
            {chosenBook ? (
              <>
                <br />
                Book: <strong>{chosenBook.book_title}</strong>
              </>
            ) : null}
          </div>

          <div className="circ-fg" style={{ marginBottom: 0 }}>
            <label htmlFor="mi-kind">Incident Type *</label>
            <select
              id="mi-kind"
              value={kind}
              disabled={busy}
              onChange={(e) => setKind(e.target.value as "damaged" | "lost")}
            >
              <option value="damaged">Damaged Book (Replacement Assessment Required)</option>
              <option value="lost">Lost Book (Affidavit &amp; Replacement Assessment Required)</option>
            </select>
          </div>

          <div className="circ-fg" style={{ marginBottom: 0 }}>
            <label htmlFor="mi-book">Target Book *</label>
            <select
              id="mi-book"
              value={selectedBookId}
              disabled={busy || activeBooks.length === 0}
              onChange={(e) => setSelectedBookId(Number(e.target.value))}
            >
              {activeBooks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.book_title} {b.copy_id ? `(Copy #${b.copy_id})` : `(Qty ${b.quantity})`}
                </option>
              ))}
            </select>
          </div>

          <div className="circ-fg" style={{ marginBottom: 0 }}>
            <label htmlFor="mi-reason">Reason * (min 3 chars)</label>
            <input
              id="mi-reason"
              type="text"
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe how the book was damaged or lost…"
            />
          </div>

          <div className="circ-fg" style={{ marginBottom: 0 }}>
            <label htmlFor="mi-notes">Condition Notes (optional)</label>
            <input
              id="mi-notes"
              type="text"
              value={notes}
              disabled={busy}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional librarian/staff notes"
            />
          </div>

          {localError && (
            <div role="alert" style={{ fontSize: "0.8rem", color: "var(--circ-danger)", fontWeight: 600 }}>
              {localError}
            </div>
          )}
        </div>

        <div className="circ-modal-foot">
          <button type="button" className="circ-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="circ-btn danger"
            disabled={busy || activeBooks.length === 0}
            onClick={handleSubmit}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Recording…
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Confirm {kind === "lost" ? "Lost" : "Damaged"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WaiveFineModal({
  card,
  busy,
  onClose,
  onConfirm,
}: {
  card: LibraryCardRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (card: LibraryCardRow, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const ref = useDialogTrap(Boolean(card), onClose, busy);

  const cardId = card?.id ?? null;
  useEffect(() => {
    setReason("");
    setLocalError(null);
  }, [cardId]);

  if (!card) return null;

  const handleSubmit = async () => {
    setLocalError(null);
    if (reason.trim().length < 3) {
      setLocalError("Please enter a waiver reason (at least 3 characters).");
      return;
    }
    await onConfirm(card, reason.trim());
  };

  return (
    <div
      className="circ-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        className="circ-modal-box sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wf-title"
        tabIndex={-1}
      >
        <div className="circ-modal-hdr">
          <h2 id="wf-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 className="h-4 w-4" style={{ color: "var(--circ-accent2)" }} aria-hidden="true" />
            Waive Unpaid Fine (Admin)
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} disabled={busy} aria-label="Close waive modal">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="circ-modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: "0.84rem", lineHeight: 1.5 }}>
            Waive fine of <strong>{formatPhp(card.fine_amount)}</strong> for{" "}
            <strong>{card.fullname}</strong> (Card #{card.id})?
            <br />
            <span style={{ opacity: 0.78 }}>
              Books: {(card.books ?? []).map((b) => b.book_title).join(", ") || "—"}
            </span>
          </div>

          <div className="circ-fg" style={{ marginBottom: 0 }}>
            <label htmlFor="wf-reason">Waiver Reason * (min 3 chars)</label>
            <input
              id="wf-reason"
              type="text"
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Library approved medical excuse or fee adjustment"
            />
          </div>

          {localError && (
            <div role="alert" style={{ fontSize: "0.8rem", color: "var(--circ-danger)", fontWeight: 600 }}>
              {localError}
            </div>
          )}
        </div>

        <div className="circ-modal-foot">
          <button type="button" className="circ-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="circ-btn green" disabled={busy} onClick={handleSubmit}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Waiving…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Confirm Waiver
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RecordPaymentModal({
  card,
  busy,
  onClose,
  onConfirm,
}: {
  card: LibraryCardRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (
    card: LibraryCardRow,
    payload: {
      amount: number;
      payment_method: "cash" | "gcash" | "bank" | "other";
      idempotency_key: string;
      note?: string;
    }
  ) => Promise<void>;
}) {
  const balance = Math.max(0, Number(card?.fine_amount ?? 0));
  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : "");
  const [method, setMethod] = useState<"cash" | "gcash" | "bank" | "other">("cash");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const ref = useDialogTrap(Boolean(card), onClose, busy);

  const cardId = card?.id ?? null;
  useEffect(() => {
    const b = Math.max(0, Number(card?.fine_amount ?? 0));
    setAmount(b > 0 ? b.toFixed(2) : "");
    setMethod("cash");
    setNote("");
    setLocalError(null);
  }, [cardId, card?.fine_amount]);

  if (!card) return null;

  const makeIdempotencyKey = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `pay-${card.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const handleSubmit = async () => {
    setLocalError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setLocalError("Payment amount must be greater than zero.");
      return;
    }
    if (parsed > balance + 0.001) {
      setLocalError(`Payment cannot exceed the outstanding fine balance (${formatPhp(balance)}).`);
      return;
    }
    await onConfirm(card, {
      amount: Number(parsed.toFixed(2)),
      payment_method: method,
      idempotency_key: makeIdempotencyKey(),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <div
      className="circ-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        className="circ-modal-box sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rp-title"
        tabIndex={-1}
      >
        <div className="circ-modal-hdr">
          <h2 id="rp-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Banknote className="h-4 w-4" style={{ color: "var(--circ-accent2)" }} aria-hidden="true" />
            Record Fine Payment
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} disabled={busy} aria-label="Close payment modal">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="circ-modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: "0.84rem", lineHeight: 1.5 }}>
            Member: <strong>{card.fullname}</strong> (Card #{card.id})
            <br />
            Books: {(card.books ?? []).map((b) => b.book_title).join(", ") || "—"}
            <br />
            Outstanding Balance: <strong>{formatPhp(balance)}</strong>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="circ-fg" style={{ marginBottom: 0 }}>
              <label htmlFor="rp-amount">Amount (PHP) *</label>
              <input
                id="rp-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={balance}
                value={amount}
                disabled={busy}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="circ-fg" style={{ marginBottom: 0 }}>
              <label htmlFor="rp-method">Method *</label>
              <select
                id="rp-method"
                value={method}
                disabled={busy}
                onChange={(e) => setMethod(e.target.value as "cash" | "gcash" | "bank" | "other")}
              >
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="bank">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="circ-fg" style={{ marginBottom: 0 }}>
            <label htmlFor="rp-note">Receipt / Reference Note (optional)</label>
            <input
              id="rp-note"
              type="text"
              value={note}
              disabled={busy}
              onChange={(e) => setNote(e.target.value)}
              placeholder="OR # or transaction reference"
            />
          </div>

          {localError && (
            <div role="alert" style={{ fontSize: "0.8rem", color: "var(--circ-danger)", fontWeight: 600 }}>
              {localError}
            </div>
          )}
        </div>

        <div className="circ-modal-foot">
          <button type="button" className="circ-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="circ-btn green"
            disabled={busy || balance <= 0}
            onClick={handleSubmit}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Recording…
              </>
            ) : (
              <>
                <Banknote className="h-4 w-4" aria-hidden="true" /> Record Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteCardModal({
  card,
  busy,
  onClose,
  onConfirm,
}: {
  card: LibraryCardRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (card: LibraryCardRow) => Promise<void>;
}) {
  const ref = useDialogTrap(Boolean(card), onClose, busy);
  if (!card) return null;

  return (
    <div
      className="circ-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        className="circ-modal-box sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dc-title"
        tabIndex={-1}
      >
        <div className="circ-modal-hdr">
          <h2 id="dc-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--circ-danger)", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Delete Library Card Record
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} disabled={busy} aria-label="Close delete modal">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="circ-modal-body">
          <p style={{ margin: 0, fontSize: "0.88rem", opacity: 0.85, lineHeight: 1.6 }}>
            Delete this record for <strong>{card.fullname}</strong> (Card #{card.id})? This cannot
            be undone.
          </p>
        </div>
        <div className="circ-modal-foot">
          <button type="button" className="circ-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="circ-btn danger"
            disabled={busy}
            onClick={() => onConfirm(card)}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteReturnModal({
  item,
  busy,
  onClose,
  onConfirm,
}: {
  item: ReturnItemRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (item: ReturnItemRow) => Promise<void>;
}) {
  const ref = useDialogTrap(Boolean(item), onClose, busy);
  if (!item) return null;

  return (
    <div
      className="circ-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        className="circ-modal-box sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dr-title"
        tabIndex={-1}
      >
        <div className="circ-modal-hdr">
          <h2 id="dr-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--circ-danger)", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Delete Return Record (Admin)
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} disabled={busy} aria-label="Close delete return modal">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="circ-modal-body">
          <p style={{ margin: 0, fontSize: "0.88rem", opacity: 0.85, lineHeight: 1.6 }}>
            Delete return item #{item.id} for <strong>{item.borrower_name}</strong> —{" "}
            <strong>{item.book_title}</strong>? This action cannot be undone.
          </p>
        </div>
        <div className="circ-modal-foot">
          <button type="button" className="circ-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="circ-btn danger"
            disabled={busy}
            onClick={() => onConfirm(item)}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
