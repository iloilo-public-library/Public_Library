"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  type LibraryCardRow,
  computeAutoValidUntil,
  formatCardTypeLabel,
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
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  const hidePatronContacts = role === "librarian" && card.card_type_category === "member";

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
            <Eye className="h-4 w-4" style={{ color: "#9fc1e1" }} aria-hidden="true" />
            Card Details
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} aria-label="Close card details">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="circ-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="circ-badge" style={{ background: "rgba(159, 193, 225, 0.14)", color: "#9fc1e1" }}>
              {card.card_type_category === "member" ? "Member" : "Borrower"}
            </span>
            <span style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono), monospace", opacity: 0.7 }}>
              Card #{card.id}
            </span>
            {totalVols > 0 && (
              <span className="circ-badge" style={{ background: "rgba(72, 199, 142, 0.14)", color: "#48c78e" }}>
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
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <User className="h-7 w-7 opacity-60 shrink-0" aria-hidden="true" />
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>{card.fullname}</div>
              {hidePatronContacts ? (
                <div style={{ fontSize: "0.76rem", opacity: 0.7 }}>
                  Registered Member · Card #{card.id}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: "0.78rem", opacity: 0.75 }}>{card.phone_number || "—"}</div>
                  <div style={{ fontSize: "0.78rem", opacity: 0.75 }}>{card.address || "—"}</div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: "0.82rem" }}>
            <div><strong>Date Issued:</strong> {card.date_issued || "—"}</div>
            <div><strong>Date of Return:</strong> {card.date_return || "—"}</div>
            <div><strong>Card Type:</strong> {formatCardTypeLabel(card.card_type)}</div>
            <div><strong>Valid Until:</strong> {card.valid_until || "—"}</div>
            {card.renewal1_checked && <div><strong>1st Renewal:</strong> {card.renewal1_date || "Yes"}</div>}
            {card.renewal2_checked && <div><strong>2nd Renewal:</strong> {card.renewal2_date || "Yes"}</div>}
          </div>

          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", opacity: 0.6, marginBottom: 8 }}>
              Books Borrowed ({books.length})
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
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "rgba(72, 199, 142, 0.08)",
                    border: "1px solid rgba(72, 199, 142, 0.2)",
                    marginBottom: 7,
                    fontSize: "0.83rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{b.book_title}</div>
                    <div style={{ fontSize: "0.74rem", opacity: 0.75 }}>
                      {b.book_id ? `Book ID #${b.book_id} · ` : ""}by {b.book_author}
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: "#48c78e" }}>×{b.quantity ?? 1}</span>
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

export function ProcessReturnModal({
  card,
  busy,
  onClose,
  onConfirm,
}: {
  card: LibraryCardRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (card: LibraryCardRow, returnDate: string) => Promise<void>;
}) {
  const [returnDate, setReturnDate] = useState(() => getManilaTodayISO());
  const ref = useDialogTrap(Boolean(card), onClose, busy);

  const cardId = card?.id ?? null;

  useEffect(() => {
    if (cardId !== null) setReturnDate(getManilaTodayISO());
  }, [cardId]);

  if (!card) return null;
  const books = card.books ?? [];

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
          <h2 id="pr-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#ffb74d", display: "flex", alignItems: "center", gap: 8 }}>
            <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
            Process Book Return
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} disabled={busy} aria-label="Close return modal">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="circ-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: "0.86rem" }}>
            Confirm returning all borrowed books for <strong>{card.fullname}</strong> (Card #{card.id}):
          </div>

          <div className="circ-fg" style={{ marginBottom: 0 }}>
            <label htmlFor="pr-date">Date Returned</label>
            <input
              id="pr-date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", opacity: 0.65, marginBottom: 8 }}>
              Books to Return ({books.length})
            </div>
            {books.length === 0 ? (
              <div style={{ fontSize: "0.82rem", opacity: 0.65 }}>No books recorded on this card.</div>
            ) : (
              books.map((b, i) => (
                <div
                  key={b.id ?? i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "rgba(255, 152, 0, 0.08)",
                    border: "1px solid rgba(255, 152, 0, 0.22)",
                    marginBottom: 6,
                    fontSize: "0.83rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{b.book_title}</div>
                    <div style={{ fontSize: "0.73rem", opacity: 0.75 }}>by {b.book_author}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: "#ffb74d" }}>×{b.quantity ?? 1}</span>
                </div>
              ))
            )}
            <div style={{ fontSize: "0.72rem", opacity: 0.65, marginTop: 6 }}>
              Partial per-book return quantities: Not available yet (returns full borrowed quantities).
            </div>
          </div>
        </div>

        <div className="circ-modal-foot">
          <button type="button" className="circ-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="circ-btn warn"
            disabled={busy || books.length === 0 || !returnDate}
            onClick={() => onConfirm(card, returnDate)}
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

export function EditCardModal({
  card,
  busy,
  onClose,
  onSave,
}: {
  card: LibraryCardRow | null;
  busy: boolean;
  onClose: () => void;
  onSave: (
    card: LibraryCardRow,
    payload: {
      date_return: string;
      valid_until: string;
      renewal1_checked: boolean;
      renewal1_date: string;
      renewal2_checked: boolean;
      renewal2_date: string;
    }
  ) => Promise<void>;
}) {
  const [dateReturn, setDateReturn] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [r1Checked, setR1Checked] = useState(false);
  const [r1Date, setR1Date] = useState("");
  const [r2Checked, setR2Checked] = useState(false);
  const [r2Date, setR2Date] = useState("");
  const ref = useDialogTrap(Boolean(card), onClose, busy);

  const cardId = card?.id ?? null;

  useEffect(() => {
    if (!card) return;
    setDateReturn(card.date_return || "");
    setValidUntil(card.valid_until || computeAutoValidUntil(card.card_type));
    setR1Checked(Boolean(card.renewal1_checked));
    setR1Date(card.renewal1_date || "");
    setR2Checked(Boolean(card.renewal2_checked));
    setR2Date(card.renewal2_date || "");
  }, [cardId]);

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
        className="circ-modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ec-title"
        tabIndex={-1}
      >
        <div className="circ-modal-hdr">
          <h2 id="ec-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Pencil className="h-4 w-4" style={{ color: "#9fc1e1" }} aria-hidden="true" />
            Edit Library Card — {card.fullname}
          </h2>
          <button type="button" className="circ-icon-btn" onClick={onClose} disabled={busy} aria-label="Close edit modal">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="circ-modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="circ-fg" style={{ marginBottom: 0 }}>
              <label htmlFor="ec-ret">Date of Return</label>
              <input
                id="ec-ret"
                type="date"
                value={dateReturn}
                onChange={(e) => setDateReturn(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="circ-fg" style={{ marginBottom: 0 }}>
              <label htmlFor="ec-valid">Valid Until</label>
              <input
                id="ec-valid"
                type="text"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", opacity: 0.65 }}>
            Renewals
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 92 }}>
              <input
                type="checkbox"
                checked={r1Checked}
                onChange={(e) => {
                  setR1Checked(e.target.checked);
                  if (e.target.checked && !r1Date) setR1Date(getManilaTodayISO());
                }}
                disabled={busy}
              />
              1st On:
            </label>
            <input
              type="date"
              value={r1Date}
              onChange={(e) => setR1Date(e.target.value)}
              disabled={!r1Checked || busy}
              style={{ flex: 1, minHeight: 40, borderRadius: 8, padding: "6px 10px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "inherit" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 92 }}>
              <input
                type="checkbox"
                checked={r2Checked}
                onChange={(e) => {
                  setR2Checked(e.target.checked);
                  if (e.target.checked && !r2Date) setR2Date(getManilaTodayISO());
                }}
                disabled={busy}
              />
              2nd On:
            </label>
            <input
              type="date"
              value={r2Date}
              onChange={(e) => setR2Date(e.target.value)}
              disabled={!r2Checked || busy}
              style={{ flex: 1, minHeight: 40, borderRadius: 8, padding: "6px 10px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "inherit" }}
            />
          </div>

          <div style={{ fontSize: "0.74rem", opacity: 0.65, display: "flex", alignItems: "center", gap: 6 }}>
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Editing cardholder contact info or borrowed books list on an existing card: Not available yet.
          </div>
        </div>

        <div className="circ-modal-foot">
          <button type="button" className="circ-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="circ-btn primary"
            disabled={busy}
            onClick={() =>
              onSave(card, {
                date_return: dateReturn,
                valid_until: validUntil,
                renewal1_checked: r1Checked,
                renewal1_date: r1Checked ? r1Date : "",
                renewal2_checked: r2Checked,
                renewal2_date: r2Checked ? r2Date : "",
              })
            }
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
          <h2 id="dc-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#ff8585", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Delete Record
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
