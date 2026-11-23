"use client";

import { useEffect, useRef } from "react";
import { Loader2, Trash2, X } from "lucide-react";

interface DeleteAnnouncementModalProps {
  open: boolean;
  title: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAnnouncementModal({
  open,
  title,
  deleting,
  onCancel,
  onConfirm,
}: DeleteAnnouncementModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  const stateRef = useRef({ deleting, onCancel });
  stateRef.current = { deleting, onCancel };

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!stateRef.current.deleting) stateRef.current.onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ann-delete-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[380px] overflow-hidden rounded-[20px] shadow-[0_28px_70px_rgba(0,0,0,0.55)]"
        style={{
          background: "var(--ann-modal-bg)",
          border: "1px solid var(--ann-modal-border)",
          color: "var(--ann-text-primary)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pb-4 pt-5"
          style={{ borderBottom: "1px solid var(--ann-border)" }}
        >
          <h2
            id="ann-delete-modal-title"
            className="flex items-center gap-2.5 text-[1.05rem] font-bold"
          >
            <Trash2
              className="h-5 w-5 shrink-0"
              style={{ color: "var(--danger)" }}
              aria-hidden="true"
            />
            <span>Delete Announcement</span>
          </h2>

          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            aria-label="Close modal"
            className="flex h-11 w-11 items-center justify-center rounded-lg transition cursor-pointer disabled:opacity-40"
            style={{ color: "var(--ann-text-muted)" }}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body (verbatim legacy wording) */}
        <div
          className="px-6 py-[22px] text-[0.86rem] leading-relaxed"
          style={{ color: "var(--ann-text-secondary)" }}
        >
          Are you sure you want to delete{" "}
          <strong style={{ color: "var(--ann-text-primary)" }}>
            &ldquo;{title}&rdquo;
          </strong>
          ? This cannot be undone.
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2.5 px-6 py-4"
          style={{ borderTop: "1px solid var(--ann-border)" }}
        >
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="min-h-[44px] rounded-full px-5 py-2 text-[0.88rem] font-semibold transition cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: "var(--ann-pill-bg)",
              border: "1px solid var(--ann-pill-border)",
              color: "var(--ann-text-secondary)",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={deleting}
            onClick={() => void onConfirm()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 py-2 text-[0.88rem] font-bold text-white transition cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: "var(--danger)" }}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
