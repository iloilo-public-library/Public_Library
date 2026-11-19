"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Loader2,
  Megaphone,
  Package,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiMutate } from "@/lib/api";

export type AdminModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; row: Record<string, unknown> }
  | { type: "inspect"; row: Record<string, unknown> }
  | { type: "review"; row: Record<string, unknown>; decision: "approve" | "reject" }
  | { type: "reset_password"; row: Record<string, unknown> }
  | { type: "return_card"; row: Record<string, unknown> }
  | { type: "delete"; row: Record<string, unknown> };

interface AdminActionModalsProps {
  resource: string;
  modal: AdminModalState;
  onClose: () => void;
  onCompleted: () => void;
}

const INPUT_CLS =
  "w-full rounded-xl border border-white/12 bg-bg1/80 px-3 py-2 text-xs text-white placeholder:text-tl/45 focus:border-accent/55 focus:outline-none";

function s(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

export function AdminActionModals({
  resource,
  modal,
  onClose,
  onCompleted,
}: AdminActionModalsProps) {
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [auxBooks, setAuxBooks] = useState<Record<string, unknown>[]>([]);
  const [auxCards, setAuxCards] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    setErrMsg(null);
    setSaving(false);

    if (modal.type === "edit" || modal.type === "inspect" || modal.type === "review" || modal.type === "return_card") {
      setForm({
        ...modal.row,
        admin_note: s(modal.row.admin_note),
        return_date: new Date().toISOString().slice(0, 10),
      });
    } else if (modal.type === "create") {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
      setForm({
        is_borrowable: true,
        volumes: 1,
        available_copies: 1,
        damaged_copies: 0,
        lost_copies: 0,
        inventory_status: "Available",
        language: "en",
        role: resource === "admins" ? "admin" : resource === "librarians" ? "librarian" : "user",
        card_type_category: "member",
        card_type: "regular",
        date_issued: today,
        date_return: nextWeek,
        return_date: today,
        quantity: 1,
        category: "general",
        pinned: false,
        event_date: today,
      });
    } else if (modal.type === "reset_password") {
      setForm({ new_password: "" });
    }

    if (modal.type === "create" && resource === "library_cards") {
      fetch("/api/admin/data?resource=books")
        .then((r) => r.json())
        .then((d: { rows?: Record<string, unknown>[] }) => setAuxBooks(d.rows ?? []))
        .catch(() => setAuxBooks([]));
    }
    if (modal.type === "create" && resource === "returns") {
      fetch("/api/admin/data?resource=library_cards")
        .then((r) => r.json())
        .then((d: { rows?: Record<string, unknown>[] }) => setAuxCards(d.rows ?? []))
        .catch(() => setAuxCards([]));
    }
  }, [modal, resource]);

  const setField = (key: string, val: unknown) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleIsbnLookup = async () => {
    const isbn = s(form.isbn).trim();
    if (!isbn) {
      setErrMsg("Enter an ISBN first to look up book metadata.");
      return;
    }
    setLookingUp(true);
    setErrMsg(null);
    try {
      const res = await fetch(
        `/api/admin/data?resource=isbn_lookup&isbn=${encodeURIComponent(isbn)}`
      );
      const data = (await res.json()) as {
        found?: boolean;
        book?: Record<string, unknown>;
      };
      if (!data.found || !data.book) {
        setErrMsg("No matching title found on Google Books or Open Library.");
        return;
      }
      setForm((prev) => ({ ...prev, ...data.book }));
    } catch {
      setErrMsg("ISBN lookup failed. You can enter book details manually.");
    } finally {
      setLookingUp(false);
    }
  };

  const submitMutation = async (
    method: "POST" | "PUT" | "DELETE",
    action: string,
    id: number | null,
    payload: Record<string, unknown> = {}
  ) => {
    setSaving(true);
    setErrMsg(null);
    try {
      await apiMutate("/api/admin/data", {
        method,
        body: { resource, action, id, payload },
      });
      onCompleted();
      onClose();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Operation failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (modal.type === "create") {
      await submitMutation("POST", "create", null, form);
    } else if (modal.type === "edit") {
      await submitMutation("PUT", "update", Number(modal.row.id), form);
    } else if (modal.type === "review") {
      await submitMutation("PUT", modal.decision, Number(modal.row.id), {
        admin_note: s(form.admin_note),
      });
    } else if (modal.type === "reset_password") {
      await submitMutation("PUT", "reset_password", Number(modal.row.id), {
        new_password: s(form.new_password),
      });
    } else if (modal.type === "return_card") {
      await submitMutation("POST", "return_books", Number(modal.row.id), {
        return_date: s(form.return_date),
      });
    }
  };

  if (modal.type === "none") return null;

  const isWide =
    (modal.type === "create" || modal.type === "edit") &&
    (resource === "books" || resource === "library_cards") ||
    modal.type === "inspect";

  const modalTitle =
    modal.type === "inspect"
      ? "Record Details"
      : modal.type === "review"
        ? modal.decision === "approve"
          ? "Approve Account Request"
          : "Reject Account Request"
        : modal.type === "reset_password"
          ? "Reset User Password"
          : modal.type === "return_card"
            ? "Process Book Return"
            : modal.type === "delete"
              ? "Confirm Deletion"
              : `${modal.type === "create" ? "Add" : "Edit"} ${resource.replace(/_/g, " ")}`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`flex max-h-[88vh] flex-col p-0 ${
          isWide ? "max-w-[660px]" : "max-w-[480px]"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold capitalize text-white">
            {resource === "books" && <BookOpen className="h-4 w-4 text-accent" />}
            {resource === "inventory" && <Package className="h-4 w-4 text-accent" />}
            {resource === "events" && <CalendarDays className="h-4 w-4 text-accent" />}
            {resource === "announcements" && <Megaphone className="h-4 w-4 text-accent" />}
            {resource === "library_cards" && <CreditCard className="h-4 w-4 text-accent" />}
            {resource === "returns" && <RotateCcw className="h-4 w-4 text-accent" />}
            {resource === "account_requests" && <UserCheck className="h-4 w-4 text-accent" />}
            {(resource === "users" || resource === "librarians" || resource === "admins") && (
              <UserPlus className="h-4 w-4 text-accent" />
            )}
            <span>{modalTitle}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Interactive administration dialog for {resource}
          </DialogDescription>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-white/60 transition hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {errMsg && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/12 px-3.5 py-2.5 text-xs text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errMsg}</span>
            </div>
          )}

          {/* INSPECT MODAL */}
          {modal.type === "inspect" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {Object.entries(modal.row)
                  .filter(([k]) => k !== "password" && k !== "books")
                  .map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-xl border border-white/8 bg-bg1/55 px-3 py-2"
                    >
                      <div className="font-mono text-[0.65rem] uppercase text-accent/80">
                        {key.replace(/_/g, " ")}
                      </div>
                      <div className="mt-0.5 break-all text-white">
                        {typeof value === "boolean"
                          ? value
                            ? "Yes"
                            : "No"
                          : s(value) || "—"}
                      </div>
                    </div>
                  ))}
              </div>
              {Array.isArray(modal.row.books) && modal.row.books.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/4 p-3">
                  <div className="mb-2 font-mono text-[0.68rem] uppercase text-accent">
                    Borrowed Books ({modal.row.books.length})
                  </div>
                  <div className="space-y-1.5">
                    {(modal.row.books as Record<string, unknown>[]).map((b, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-bg1/60 px-3 py-1.5"
                      >
                        <div>
                          <div className="font-semibold text-white">{s(b.book_title)}</div>
                          <div className="text-[0.68rem] text-tl/65">
                            {s(b.book_author)} {b.book_isbn ? `· ISBN ${s(b.book_isbn)}` : ""}
                          </div>
                        </div>
                        <span className="font-mono text-accent">x{s(b.quantity || 1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* DELETE MODAL */}
          {modal.type === "delete" && (
            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger/10 p-4 text-danger">
                <Trash2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">This action permanently removes record #{s(modal.row.id)}.</p>
                  <p className="mt-1 text-tl/80">
                    {s(modal.row.title || modal.row.fullname || modal.row.book_title || modal.row.email)}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2.5">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={saving}
                  onClick={() => submitMutation("DELETE", "delete", Number(modal.row.id))}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete Permanently
                </Button>
              </div>
            </div>
          )}

          {/* ACCOUNT REQUEST APPROVE / REJECT */}
          {modal.type === "review" && (
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div className="rounded-xl border border-white/10 bg-bg1/60 p-3.5 space-y-1">
                <div className="font-semibold text-white">
                  {s(modal.row.fullname) !== "—" ? s(modal.row.fullname) : `User #${s(modal.row.user_id)}`}
                </div>
                <div className="font-mono text-accent">{s(modal.row.email)}</div>
                <div className="text-tl/75">
                  Request Type: <span className="uppercase font-semibold">{s(modal.row.request_type)}</span>
                </div>
                {s(modal.row.reason) && <div className="text-tl/70">{s(modal.row.reason)}</div>}
              </div>

              <div>
                <label className="mb-1.5 block font-semibold text-tl">
                  Administrator Note (sent to patron notification inbox)
                </label>
                <textarea
                  rows={3}
                  value={s(form.admin_note)}
                  onChange={(e) => setField("admin_note", e.target.value)}
                  placeholder={
                    modal.decision === "approve"
                      ? "Optional welcome or approval note..."
                      : "Provide reason for rejection..."
                  }
                  className={INPUT_CLS}
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={modal.decision === "approve" ? "accent" : "danger"}
                  size="sm"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : modal.decision === "approve" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {modal.decision === "approve" ? "Confirm Approval" : "Confirm Rejection"}
                </Button>
              </div>
            </form>
          )}

          {/* RESET PASSWORD */}
          {modal.type === "reset_password" && (
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div className="rounded-xl border border-white/10 bg-bg1/60 p-3">
                Reset password for <strong className="text-white">{s(modal.row.fullname || modal.row.email)}</strong>
              </div>
              <div>
                <label className="mb-1.5 block font-semibold text-tl">New Password *</label>
                <input
                  type="password"
                  required
                  value={s(form.new_password)}
                  onChange={(e) => setField("new_password", e.target.value)}
                  placeholder="Min 8 chars, upper, lower, digit, @$!%*?&_#^"
                  className={INPUT_CLS}
                />
              </div>
              <div className="flex justify-end gap-2.5">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="sm" disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  Update Password
                </Button>
              </div>
            </form>
          )}

          {/* RETURN CARD BOOKS */}
          {modal.type === "return_card" && (
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div className="rounded-xl border border-white/10 bg-bg1/60 p-3.5">
                <div className="font-bold text-white">
                  Card #{s(modal.row.id)} — {s(modal.row.fullname)}
                </div>
                <div className="mt-1 text-tl/70">
                  Will log return items and restore available copies to book inventory.
                </div>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-tl">Return Date *</label>
                <input
                  type="date"
                  required
                  value={s(form.return_date)}
                  onChange={(e) => setField("return_date", e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div className="flex justify-end gap-2.5">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="sm" disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Confirm Return
                </Button>
              </div>
            </form>
          )}

          {/* CREATE / EDIT FORMS */}
          {(modal.type === "create" || modal.type === "edit") && (
            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              {/* BOOKS FORM */}
              {resource === "books" && (
                <>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="mb-1 block font-semibold text-tl">ISBN *</label>
                      <input
                        required
                        value={s(form.isbn)}
                        onChange={(e) => setField("isbn", e.target.value)}
                        placeholder="9780140449136"
                        className={INPUT_CLS}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={lookingUp}
                      onClick={handleIsbnLookup}
                    >
                      {lookingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      Lookup ISBN
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Title *</label>
                      <input
                        required
                        value={s(form.title)}
                        onChange={(e) => setField("title", e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Author *</label>
                      <input
                        required
                        value={s(form.author)}
                        onChange={(e) => setField("author", e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Call Number</label>
                      <input
                        value={s(form.call_number)}
                        onChange={(e) => setField("call_number", e.target.value)}
                        placeholder="QA76.73"
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Category</label>
                      <input
                        value={s(form.category)}
                        onChange={(e) => setField("category", e.target.value)}
                        placeholder="Fiction, History, Science..."
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Class / Genre</label>
                      <input
                        value={s(form.class)}
                        onChange={(e) => setField("class", e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Publisher</label>
                      <input
                        value={s(form.publisher)}
                        onChange={(e) => setField("publisher", e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Published Date</label>
                      <input
                        value={s(form.published_date)}
                        onChange={(e) => setField("published_date", e.target.value)}
                        placeholder="2024"
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Total Volumes</label>
                      <input
                        type="number"
                        min={0}
                        value={s(form.volumes)}
                        onChange={(e) => setField("volumes", Number(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Damaged Copies</label>
                      <input
                        type="number"
                        min={0}
                        value={s(form.damaged_copies)}
                        onChange={(e) => setField("damaged_copies", Number(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Lost Copies</label>
                      <input
                        type="number"
                        min={0}
                        value={s(form.lost_copies)}
                        onChange={(e) => setField("lost_copies", Number(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Shelf Location</label>
                      <input
                        value={s(form.shelf_location)}
                        onChange={(e) => setField("shelf_location", e.target.value)}
                        placeholder="A-Row 2"
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Source of Fund</label>
                      <input
                        value={s(form.source_of_fund)}
                        onChange={(e) => setField("source_of_fund", e.target.value)}
                        placeholder="Donation / Purchase"
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 pt-1 text-tl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.is_borrowable)}
                      onChange={(e) => setField("is_borrowable", e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    Available for Patron Borrowing
                  </label>
                </>
              )}

              {/* INVENTORY FORM */}
              {resource === "inventory" && (
                <>
                  <div className="rounded-xl border border-white/10 bg-bg1/60 p-3 font-semibold text-white">
                    {s(form.book_title)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Total Volumes</label>
                      <input
                        type="number"
                        min={0}
                        value={s(form.volumes)}
                        onChange={(e) => setField("volumes", Number(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Available Copies</label>
                      <input
                        type="number"
                        min={0}
                        value={s(form.available_copies)}
                        onChange={(e) => setField("available_copies", Number(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Damaged Copies</label>
                      <input
                        type="number"
                        min={0}
                        value={s(form.damaged_copies)}
                        onChange={(e) => setField("damaged_copies", Number(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Lost Copies</label>
                      <input
                        type="number"
                        min={0}
                        value={s(form.lost_copies)}
                        onChange={(e) => setField("lost_copies", Number(e.target.value))}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Shelf Location</label>
                      <input
                        value={s(form.shelf_location)}
                        onChange={(e) => setField("shelf_location", e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Status</label>
                      <select
                        value={s(form.status) || "Available"}
                        onChange={(e) => setField("status", e.target.value)}
                        className={INPUT_CLS}
                      >
                        {["Available", "Low Stock", "Out of Stock", "Maintenance"].map((st) => (
                          <option key={st} value={st} className="bg-modal text-white">
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* USERS / LIBRARIANS / ADMINS CREATE FORM */}
              {(resource === "users" || resource === "librarians" || resource === "admins") && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold text-tl">First Name *</label>
                    <input
                      required
                      value={s(form.firstname)}
                      onChange={(e) => setField("firstname", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Last Name *</label>
                    <input
                      required
                      value={s(form.lastname)}
                      onChange={(e) => setField("lastname", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block font-semibold text-tl">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={s(form.email)}
                      onChange={(e) => setField("email", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block font-semibold text-tl">Password *</label>
                    <input
                      type="password"
                      required
                      value={s(form.password)}
                      onChange={(e) => setField("password", e.target.value)}
                      placeholder="Min 8 chars + upper, lower, digit, @$!%*?&_#^"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Gender</label>
                    <select
                      value={s(form.gender)}
                      onChange={(e) => setField("gender", e.target.value)}
                      className={INPUT_CLS}
                    >
                      <option value="" className="bg-modal text-white">Select</option>
                      <option value="Male" className="bg-modal text-white">Male</option>
                      <option value="Female" className="bg-modal text-white">Female</option>
                      <option value="Others" className="bg-modal text-white">Others</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Phone Number</label>
                    <input
                      value={s(form.phone_number)}
                      onChange={(e) => setField("phone_number", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              )}

              {/* LIBRARY CARDS FORM */}
              {resource === "library_cards" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Category</label>
                    <select
                      value={s(form.card_type_category) || "member"}
                      onChange={(e) => setField("card_type_category", e.target.value)}
                      className={INPUT_CLS}
                    >
                      <option value="member" className="bg-modal text-white">Member</option>
                      <option value="borrower" className="bg-modal text-white">Borrower</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Card Type</label>
                    <select
                      value={s(form.card_type) || "regular"}
                      onChange={(e) => setField("card_type", e.target.value)}
                      className={INPUT_CLS}
                    >
                      <option value="regular" className="bg-modal text-white">Regular</option>
                      <option value="student" className="bg-modal text-white">Student</option>
                      <option value="senior" className="bg-modal text-white">Senior Citizen</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">First Name *</label>
                    <input
                      required
                      value={s(form.firstname)}
                      onChange={(e) => setField("firstname", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Last Name *</label>
                    <input
                      required
                      value={s(form.lastname)}
                      onChange={(e) => setField("lastname", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Phone Number</label>
                    <input
                      value={s(form.phone_number)}
                      onChange={(e) => setField("phone_number", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Address</label>
                    <input
                      value={s(form.address)}
                      onChange={(e) => setField("address", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Date Issued</label>
                    <input
                      type="date"
                      value={s(form.date_issued)}
                      onChange={(e) => setField("date_issued", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Due / Return Date</label>
                    <input
                      type="date"
                      value={s(form.date_return)}
                      onChange={(e) => setField("date_return", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  {modal.type === "create" && (
                    <>
                      <div>
                        <label className="mb-1 block font-semibold text-tl">Borrowed Book (optional)</label>
                        <select
                          value={s(form.book_id)}
                          onChange={(e) => setField("book_id", e.target.value)}
                          className={INPUT_CLS}
                        >
                          <option value="" className="bg-modal text-white">None</option>
                          {auxBooks.map((b) => (
                            <option key={s(b.id)} value={s(b.id)} className="bg-modal text-white">
                              #{s(b.id)} — {s(b.title).slice(0, 40)} ({s(b.available_copies)} avail)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-tl">Quantity</label>
                        <input
                          type="number"
                          min={1}
                          value={s(form.quantity || 1)}
                          onChange={(e) => setField("quantity", Number(e.target.value))}
                          className={INPUT_CLS}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* RETURNS FORM */}
              {resource === "returns" && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Select Library Card *</label>
                    <select
                      required
                      value={s(form.card_id)}
                      onChange={(e) => setField("card_id", e.target.value)}
                      className={INPUT_CLS}
                    >
                      <option value="" className="bg-modal text-white">Choose a card...</option>
                      {auxCards.map((c) => (
                        <option key={s(c.id)} value={s(c.id)} className="bg-modal text-white">
                          Card #{s(c.id)} — {s(c.fullname)} ({s(c.books_count)} books)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Return Date *</label>
                    <input
                      type="date"
                      required
                      value={s(form.return_date)}
                      onChange={(e) => setField("return_date", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              )}

              {/* EVENTS FORM */}
              {resource === "events" && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Event Title *</label>
                    <input
                      required
                      value={s(form.title)}
                      onChange={(e) => setField("title", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Event Date *</label>
                      <input
                        type="date"
                        required
                        value={s(form.event_date)}
                        onChange={(e) => setField("event_date", e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Category</label>
                      <select
                        value={s(form.category) || "general"}
                        onChange={(e) => setField("category", e.target.value)}
                        className={INPUT_CLS}
                      >
                        {["general", "event", "meeting", "holiday", "reminder", "urgent"].map((cat) => (
                          <option key={cat} value={cat} className="bg-modal text-white capitalize">
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Start Time</label>
                      <input
                        type="time"
                        value={s(form.start_time)}
                        onChange={(e) => setField("start_time", e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-tl">End Time</label>
                      <input
                        type="time"
                        value={s(form.end_time)}
                        onChange={(e) => setField("end_time", e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Location</label>
                    <input
                      value={s(form.location)}
                      onChange={(e) => setField("location", e.target.value)}
                      placeholder="Iloilo City Public Library Main Hall"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Description</label>
                    <textarea
                      rows={3}
                      value={s(form.description)}
                      onChange={(e) => setField("description", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              )}

              {/* ANNOUNCEMENTS FORM */}
              {resource === "announcements" && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Notice Title *</label>
                    <input
                      required
                      maxLength={120}
                      value={s(form.title)}
                      onChange={(e) => setField("title", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="mb-1 block font-semibold text-tl">Category</label>
                      <select
                        value={s(form.category) || "general"}
                        onChange={(e) => setField("category", e.target.value)}
                        className={INPUT_CLS}
                      >
                        {["general", "urgent", "event", "reminder"].map((cat) => (
                          <option key={cat} value={cat} className="bg-modal text-white capitalize">
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 pt-4 text-tl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(form.pinned)}
                        onChange={(e) => setField("pinned", e.target.checked)}
                        className="accent-[var(--accent)]"
                      />
                      Pin announcement to top
                    </label>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-tl">Message Body *</label>
                    <textarea
                      required
                      rows={4}
                      value={s(form.body)}
                      onChange={(e) => setField("body", e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="sm" disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {modal.type === "create" ? "Save Record" : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
