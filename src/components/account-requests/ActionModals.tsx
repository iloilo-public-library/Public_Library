"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  MailCheck,
  PauseCircle,
  RefreshCw,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { type AccountRequestRow, type RequestType, getDisplayName } from "./types";

function useDialogAccessibility(isOpen: boolean, onClose: () => void, busy: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ onClose, busy });
  stateRef.current = { onClose, busy };

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !stateRef.current.busy) {
        e.preventDefault();
        stateRef.current.onClose();
        return;
      }
      if (e.key === "Tab" && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      prev?.focus();
    };
  }, [isOpen]);

  return ref;
}

const CONSEQUENCES: Record<
  RequestType,
  Array<{ icon: typeof CheckCircle2; color: string; text: string }>
> = {
  delete: [
    { icon: Trash2, color: "var(--req-danger)", text: "Account and credentials will be permanently deleted" },
    { icon: XCircle, color: "var(--req-danger)", text: "All favorites, search history and preferences erased" },
    { icon: AlertTriangle, color: "var(--req-warn)", text: "This action cannot be undone — ever" },
  ],
  deactivate: [
    { icon: PauseCircle, color: "var(--req-warn)", text: "User will be logged out immediately" },
    { icon: XCircle, color: "var(--req-danger)", text: "Login blocked until reactivated by staff" },
    { icon: CheckCircle2, color: "var(--req-accent2)", text: "All data and borrowing history are preserved" },
  ],
  renew: [
    { icon: RefreshCw, color: "var(--req-renew)", text: "Library card renewal dates will be applied" },
    { icon: CheckCircle2, color: "var(--req-accent2)", text: "User will be notified of the approval" },
    { icon: CalendarCheck, color: "var(--req-accent)", text: "Card validity and renewal slots updated" },
  ],
  register: [
    { icon: UserCheck, color: "var(--req-reg)", text: "Account will be activated and fully accessible" },
    { icon: CheckCircle2, color: "var(--req-accent2)", text: "User can log in immediately after approval" },
    { icon: MailCheck, color: "var(--req-accent)", text: "Approval notification will be sent to the user" },
  ],
};

interface ApproveModalProps {
  row: AccountRequestRow | null;
  role?: "admin" | "librarian";
  busy: boolean;
  onClose: () => void;
  onConfirm: (row: AccountRequestRow, adminNote: string) => Promise<void>;
}

export function ApproveModal({
  row,
  role = "admin",
  busy,
  onClose,
  onConfirm,
}: ApproveModalProps) {
  const [note, setNote] = useState("");
  const dialogRef = useDialogAccessibility(Boolean(row), onClose, busy);
  const isLibrarian = role === "librarian";

  useEffect(() => {
    if (row) setNote("");
  }, [row?.id]);

  if (!row) return null;
  const displayName = getDisplayName(row);
  const items =
    isLibrarian && row.request_type === "renew"
      ? [
          { icon: RefreshCw, color: "var(--req-renew)", text: "Library card renewal dates will be applied" },
          { icon: CheckCircle2, color: "var(--req-accent2)", text: "Member will be notified of the approval" },
          { icon: CalendarCheck, color: "var(--req-accent)", text: "Card validity and renewal slots updated" },
        ]
      : (CONSEQUENCES[row.request_type] ?? []);

  return (
    <div
      className="req-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="req-modal-dialog req-modal-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="req-approve-title"
        tabIndex={-1}
      >
        <div className="req-modal-header">
          <h2
            id="req-approve-title"
            className="req-modal-title"
            style={isLibrarian ? { color: "var(--req-accent2)" } : undefined}
          >
            <CheckCircle2 className="h-4 w-4" style={{ color: "var(--req-accent2)" }} aria-hidden="true" />
            {isLibrarian ? "Approve Renewal" : "Approve Request"}
          </h2>
          <button
            type="button"
            className="req-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close approve modal"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="req-modal-body">
          <p style={{ fontSize: "0.84rem", color: "var(--req-tl)", margin: "0 0 12px", lineHeight: 1.5 }}>
            Confirm approving this {isLibrarian ? "renewal " : ""}request for{" "}
            <strong style={{ color: "var(--req-text)" }}>{displayName}</strong> ({row.username}):
          </p>

          <div className="req-consequence-list">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.text} className="req-consequence-item">
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={{ color: item.color, marginTop: 2 }}
                    aria-hidden="true"
                  />
                  <span>{item.text}</span>
                </div>
              );
            })}
          </div>

          <label htmlFor="approveNoteInput" className="req-fg-lbl">
            {isLibrarian ? "Note" : "Admin Note"}{" "}
            <span style={{ fontWeight: 400, opacity: 0.65, textTransform: "none" }}>
              (optional)
            </span>
          </label>
          <textarea
            id="approveNoteInput"
            className="req-fg-textarea"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              isLibrarian
                ? "Leave a note for the member…"
                : "Add an optional note for the user…"
            }
            disabled={busy}
          />
        </div>

        <div className="req-modal-footer">
          <button type="button" className="req-btn-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="req-btn-approve"
            disabled={busy}
            onClick={() => onConfirm(row, note.trim())}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Processing…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface RejectModalProps {
  row: AccountRequestRow | null;
  role?: "admin" | "librarian";
  busy: boolean;
  onClose: () => void;
  onConfirm: (row: AccountRequestRow, adminNote: string) => Promise<void>;
}

export function RejectModal({
  row,
  role = "admin",
  busy,
  onClose,
  onConfirm,
}: RejectModalProps) {
  const [note, setNote] = useState("");
  const dialogRef = useDialogAccessibility(Boolean(row), onClose, busy);
  const isLibrarian = role === "librarian";

  useEffect(() => {
    if (row) setNote("");
  }, [row?.id]);

  if (!row) return null;
  const displayName = getDisplayName(row);

  return (
    <div
      className="req-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="req-modal-dialog req-modal-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="req-reject-title"
        tabIndex={-1}
      >
        <div className="req-modal-header">
          <h2
            id="req-reject-title"
            className="req-modal-title"
            style={isLibrarian ? { color: "var(--req-danger)" } : undefined}
          >
            <XCircle className="h-4 w-4" style={{ color: "var(--req-danger)" }} aria-hidden="true" />
            {isLibrarian ? "Reject Renewal" : "Reject Request"}
          </h2>
          <button
            type="button"
            className="req-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close reject modal"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="req-modal-body">
          <p style={{ fontSize: "0.84rem", color: "var(--req-tl)", margin: "0 0 14px", lineHeight: 1.55 }}>
            {row.request_type === "renew" ? (
              <>
                The member&apos;s card renewal request for{" "}
                <strong style={{ color: "var(--req-text)" }}>{displayName}</strong> will be
                rejected. Their library card{" "}
                <strong style={{ color: "var(--req-text)" }}>will not be renewed</strong>.
              </>
            ) : row.request_type === "register" ? (
              <>
                The pending registration for{" "}
                <strong style={{ color: "var(--req-text)" }}>{displayName}</strong> will be
                rejected and their pending account will be deactivated/removed.
              </>
            ) : (
              <>
                The account for{" "}
                <strong style={{ color: "var(--req-text)" }}>{displayName}</strong> will remain{" "}
                <strong style={{ color: "var(--req-text)" }}>fully active</strong>. Their request
                will be marked as rejected.
              </>
            )}
          </p>

          <label htmlFor="rejectNoteInput" className="req-fg-lbl">
            Reason for Rejection{" "}
            <span style={{ fontWeight: 400, opacity: 0.65, textTransform: "none" }}>
              (optional)
            </span>
          </label>
          <textarea
            id="rejectNoteInput"
            className="req-fg-textarea"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              isLibrarian
                ? "e.g. Outstanding items, insufficient reason provided…"
                : "Explain why this request was rejected (optional)…"
            }
            disabled={busy}
          />
        </div>

        <div className="req-modal-footer">
          <button type="button" className="req-btn-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="req-btn-reject"
            disabled={busy}
            onClick={() => onConfirm(row, note.trim())}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Processing…
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteRecordModalProps {
  row: AccountRequestRow | null;
  role?: "admin" | "librarian";
  busy: boolean;
  onClose: () => void;
  onConfirm: (row: AccountRequestRow) => Promise<void>;
}

export function DeleteRecordModal({
  row,
  role = "admin",
  busy,
  onClose,
  onConfirm,
}: DeleteRecordModalProps) {
  const dialogRef = useDialogAccessibility(Boolean(row), onClose, busy);
  const isLibrarian = role === "librarian";

  if (!row) return null;
  const displayName = getDisplayName(row);

  return (
    <div
      className="req-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="req-modal-dialog req-modal-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="req-delete-title"
        tabIndex={-1}
      >
        <div className="req-modal-header">
          <h2 id="req-delete-title" className="req-modal-title">
            <Trash2 className="h-4 w-4" style={{ color: "var(--req-danger)" }} aria-hidden="true" />
            {isLibrarian ? "Delete Renewal Record" : "Delete Request Record"}
          </h2>
          <button
            type="button"
            className="req-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close delete modal"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="req-modal-body">
          <p style={{ fontSize: "0.85rem", color: "var(--req-tl)", margin: 0, lineHeight: 1.55 }}>
            {isLibrarian ? (
              <>
                Delete this renewal record for{" "}
                <strong style={{ color: "var(--req-text)" }}>{displayName}</strong> permanently?
                This cannot be undone.
              </>
            ) : (
              <>
                Delete this processed request record for{" "}
                <strong style={{ color: "var(--req-text)" }}>{displayName}</strong> permanently?
                This cannot be undone.
              </>
            )}
          </p>
        </div>

        <div className="req-modal-footer">
          <button type="button" className="req-btn-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="req-btn-reject"
            disabled={busy}
            onClick={() => onConfirm(row)}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete Record
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
