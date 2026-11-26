"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Barcode,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Layers,
  Loader2,
  MapPin,
  Megaphone,
  Package,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AddBookModal } from "@/components/admin/AddBookModal";
import type { AddBookWithCopiesInput, CopyCondition } from "@/types/inventory";
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

const FIELD_LABEL =
  "mb-1.5 flex items-center justify-between text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-tl/85";
const INPUT_CLS =
  "w-full rounded-xl border border-white/12 bg-bg1/85 px-3 py-2 text-xs text-white placeholder:text-tl/40 transition focus:border-accent/60 focus:bg-bg1 focus:outline-none focus:ring-2 focus:ring-accent/15";
const SECTION_CARD =
  "rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3.5";

const COPY_CONDITIONS: CopyCondition[] = [
  "Good",
  "Fair",
  "Damaged",
  "Destroyed",
  "Lost",
  "Under Repair",
];

const INSPECT_HIDDEN_KEYS = new Set([
  "password",
  "books",
  "copies",
  "total_copies",
  "inventory_status",
  "damaged_accessions",
  "thumbnail_url",
  "photo_path",
  "valid_id_path",
]);

const INSPECT_LABELS: Record<string, string> = {
  id: "Record ID",
  book_id: "Book ID",
  user_id: "Member ID",
  card_id: "Card ID",
  catalog_code: "Catalog Code",
  call_number: "Call Number",
  book_title: "Book Title",
  book_author: "Author",
  title: "Title",
  author: "Author",
  isbn: "ISBN",
  category: "Collection Category",
  class: "Class / Genre",
  publisher: "Publisher",
  published_date: "Published",
  edition: "Edition",
  page_count: "Page Count",
  volumes: "Total Copies",
  available_copies: "Available Copies",
  borrowed_copies: "Borrowed Copies",
  damaged_copies: "Damaged Copies",
  destroyed_copies: "Destroyed Copies",
  lost_copies: "Lost Copies",
  condition_status: "Condition Summary",
  shelf_location: "Shelf Location",
  source_of_fund: "Source of Fund",
  cost_price: "Cost Price",
  is_borrowable: "Patron Borrowable",
  fullname: "Full Name",
  firstname: "First Name",
  lastname: "Last Name",
  email: "Email Address",
  email_display: "Email Address",
  phone_number: "Phone Number",
  role: "Account Role",
  status: "Status",
  is_active: "Account Active",
  is_approved: "Approved",
  is_locked: "Locked",
  failed_attempts: "Failed Login Attempts",
  created_at: "Created At",
  updated_at: "Last Updated",
  last_seen: "Last Active",
  reviewed_at: "Reviewed At",
};

function s(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function formatInspectValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  const str = String(val);
  if (str.startsWith("gAAAAAB")) return "[Protected Record]";
  if (
    (key === "created_at" || key === "updated_at" || key === "last_seen" || key === "reviewed_at") &&
    str.includes("T")
  ) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }
  return str;
}

function getConditionBadgeTone(cond: string): string {
  if (cond === "Destroyed" || cond === "Lost") {
    return "border-danger/35 bg-danger/15 text-danger";
  }
  if (cond === "Damaged" || cond === "Under Repair") {
    return "border-warn/35 bg-warn/15 text-warn";
  }
  if (cond === "Fair") {
    return "border-accent/35 bg-accent/15 text-accent";
  }
  return "border-accent2/30 bg-accent2/12 text-accent2";
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
  const [editableCopies, setEditableCopies] = useState<Array<Record<string, unknown>>>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [auxBooks, setAuxBooks] = useState<Record<string, unknown>[]>([]);
  const [auxCards, setAuxCards] = useState<Record<string, unknown>[]>([]);

  // Stable scalar identity key so parent re-renders never wipe out active form edits
  const modalIdentity = useMemo(() => {
    if (modal.type === "none") return "none";
    const rowId = "row" in modal ? s(modal.row.id) : "new";
    const dec = modal.type === "review" ? modal.decision : "";
    return `${resource}:${modal.type}:${rowId}:${dec}`;
  }, [modal, resource]);

  const prevIdentityRef = useRef<string>("none");

  useEffect(() => {
    if (modalIdentity === prevIdentityRef.current) return;
    prevIdentityRef.current = modalIdentity;

    setErrMsg(null);
    setSaving(false);
    setShowPassword(false);
    setConfirmPassword("");

    if (
      modal.type === "edit" ||
      modal.type === "inspect" ||
      modal.type === "review" ||
      modal.type === "return_card"
    ) {
      setForm({
        ...modal.row,
        destroyed_copies: Number(modal.row.destroyed_copies ?? 0),
        admin_note: s(modal.row.admin_note),
        return_date: new Date().toISOString().slice(0, 10),
      });
      const rawCopies = Array.isArray(modal.row.copies)
        ? (modal.row.copies as Record<string, unknown>[]).map((c) => ({ ...c }))
        : [];
      setEditableCopies(rawCopies);
    } else if (modal.type === "create") {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
      setForm({
        is_borrowable: true,
        volumes: 1,
        available_copies: 1,
        damaged_copies: 0,
        destroyed_copies: 0,
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
      setEditableCopies([]);
    } else if (modal.type === "reset_password") {
      setForm({ new_password: "" });
      setEditableCopies([]);
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
  }, [modal, modalIdentity, resource]);

  const setField = (key: string, val: unknown) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  // Update a single physical copy's condition & automatically recalculate aggregate stock counts
  const handleCopyConditionChange = (index: number, nextCondition: CopyCondition) => {
    setEditableCopies((prev) => {
      const next = prev.map((cp, idx) => {
        if (idx !== index) return cp;
        const unusable =
          nextCondition === "Damaged" ||
          nextCondition === "Destroyed" ||
          nextCondition === "Lost" ||
          nextCondition === "Under Repair";
        return {
          ...cp,
          condition: nextCondition,
          circulation_status: unusable
            ? "Unusable"
            : String(cp.circulation_status) === "Borrowed"
              ? "Borrowed"
              : "Available",
        };
      });

      let avail = 0;
      let dmg = 0;
      let destroyed = 0;
      let lost = 0;
      for (const cp of next) {
        const cond = String(cp.condition || "Good");
        if (cond === "Damaged" || cond === "Under Repair") dmg++;
        else if (cond === "Destroyed") destroyed++;
        else if (cond === "Lost") lost++;
        else if (String(cp.circulation_status) !== "Borrowed") avail++;
      }

      setForm((f) => ({
        ...f,
        volumes: Math.max(Number(f.volumes ?? next.length), next.length),
        available_copies: avail,
        damaged_copies: dmg,
        destroyed_copies: destroyed,
        lost_copies: lost,
      }));

      return next;
    });
  };

  const handleCopyNotesChange = (index: number, notes: string) => {
    setEditableCopies((prev) =>
      prev.map((cp, idx) => (idx === index ? { ...cp, condition_notes: notes } : cp))
    );
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

    if (modal.type === "reset_password") {
      const pw = s(form.new_password);
      if (pw !== confirmPassword) {
        setErrMsg("New password and confirmation password do not match.");
        return;
      }
      await submitMutation("PUT", "reset_password", Number(modal.row.id), {
        new_password: pw,
      });
      return;
    }

    if (
      modal.type === "create" &&
      (resource === "users" || resource === "librarians" || resource === "admins")
    ) {
      const pw = s(form.password);
      if (pw !== confirmPassword) {
        setErrMsg("Password and confirm password do not match.");
        return;
      }
    }

    if (modal.type === "create") {
      await submitMutation("POST", "create", null, form);
    } else if (modal.type === "edit") {
      const payload =
        (resource === "books" || resource === "inventory") && editableCopies.length > 0
          ? { ...form, copies: editableCopies }
          : form;
      await submitMutation("PUT", "update", Number(modal.row.id), payload);
    } else if (modal.type === "review") {
      await submitMutation("PUT", modal.decision, Number(modal.row.id), {
        admin_note: s(form.admin_note),
      });
    } else if (modal.type === "return_card") {
      await submitMutation("POST", "return_books", Number(modal.row.id), {
        return_date: s(form.return_date),
      });
    }
  };

  if (modal.type === "none") return null;

  const isWide =
    modal.type === "inspect" ||
    ((modal.type === "create" || modal.type === "edit") &&
      (resource === "books" ||
        resource === "inventory" ||
        resource === "library_cards" ||
        resource === "events" ||
        resource === "announcements" ||
        resource === "users" ||
        resource === "librarians" ||
        resource === "admins"));

  const modalTitle =
    modal.type === "inspect"
      ? `Inspect ${resource.replace(/_/g, " ")} Record`
      : modal.type === "review"
        ? modal.decision === "approve"
          ? "Approve Account Request"
          : "Reject Account Request"
        : modal.type === "reset_password"
          ? "Reset Account Password"
          : modal.type === "return_card"
            ? "Process Book Return"
            : modal.type === "delete"
              ? "Confirm Permanent Deletion"
              : modal.type === "create" && resource === "books"
                ? "Add Books & Physical Copies"
                : modal.type === "edit" && resource === "books"
                  ? "Edit Book & Physical Copies"
                  : modal.type === "edit" && resource === "inventory"
                    ? "Manage Inventory & Copy Conditions"
                    : `${modal.type === "create" ? "Add" : "Edit"} ${resource.replace(/_/g, " ")}`;

  const pwValue =
    modal.type === "reset_password" ? s(form.new_password) : s(form.password);
  const pwChecks = [
    { label: "8–64 chars", ok: pwValue.length >= 8 && pwValue.length <= 64 },
    { label: "Uppercase", ok: /[A-Z]/.test(pwValue) },
    { label: "Lowercase", ok: /[a-z]/.test(pwValue) },
    { label: "Number", ok: /\d/.test(pwValue) },
    { label: "Symbol (@$!%*?&_#^)", ok: /[@$!%*?&_#^]/.test(pwValue) },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`flex max-h-[90vh] flex-col p-0 ${
          modal.type === "create" && resource === "books"
            ? "max-w-[740px]"
            : isWide
              ? "max-w-[700px]"
              : "max-w-[520px]"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
          <DialogTitle className="flex items-center gap-2.5 text-sm font-bold capitalize text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/25 bg-accent/12 text-accent">
              {resource === "books" && <BookOpen className="h-4 w-4" />}
              {resource === "inventory" && <Package className="h-4 w-4" />}
              {resource === "events" && <CalendarDays className="h-4 w-4" />}
              {resource === "announcements" && <Megaphone className="h-4 w-4" />}
              {resource === "library_cards" && <CreditCard className="h-4 w-4" />}
              {resource === "returns" && <RotateCcw className="h-4 w-4" />}
              {resource === "account_requests" && <UserCheck className="h-4 w-4" />}
              {(resource === "users" || resource === "librarians" || resource === "admins") && (
                <UserPlus className="h-4 w-4" />
              )}
            </span>
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
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/12 px-3.5 py-2.5 text-xs text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errMsg}</span>
            </div>
          )}

          {/* 1. INSPECT MODAL (Curated Sections + Copy Condition Breakdown) */}
          {modal.type === "inspect" && (
            <div className="space-y-4 text-xs">
              {/* Header Summary Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent/[0.05] p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-accent/30 bg-accent/15 px-2 py-0.5 font-mono text-[0.7rem] font-bold text-accent">
                      #{s(modal.row.book_id ?? modal.row.id)}
                    </span>
                    {modal.row.catalog_code ? (
                      <span className="rounded-md border border-white/12 bg-white/6 px-2 py-0.5 font-mono text-[0.7rem] text-tl">
                        {s(modal.row.catalog_code)}
                      </span>
                    ) : null}
                    <h3 className="text-sm font-bold text-white">
                      {s(
                        modal.row.title ||
                          modal.row.book_title ||
                          modal.row.fullname ||
                          modal.row.borrower_name ||
                          modal.row.email ||
                          `Record #${s(modal.row.id)}`
                      )}
                    </h3>
                  </div>
                  {Boolean(modal.row.author || modal.row.book_author || modal.row.email) && (
                    <p className="mt-1 text-xs text-tl/75">
                      {s(modal.row.author || modal.row.book_author || modal.row.email)}
                      {modal.row.isbn ? ` · ISBN ${s(modal.row.isbn)}` : ""}
                    </p>
                  )}
                </div>

                {Boolean(modal.row.condition_status || modal.row.status) && (
                  <span
                    className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-[0.7rem] font-bold capitalize ${
                      s(modal.row.condition_status || modal.row.status)
                        .toLowerCase()
                        .includes("destroyed") ||
                      s(modal.row.condition_status || modal.row.status)
                        .toLowerCase()
                        .includes("lost")
                        ? "border-danger/35 bg-danger/15 text-danger"
                        : s(modal.row.condition_status || modal.row.status)
                              .toLowerCase()
                              .includes("damaged")
                          ? "border-warn/35 bg-warn/15 text-warn"
                          : "border-accent2/30 bg-accent2/15 text-accent2"
                    }`}
                  >
                    {s(modal.row.condition_status || modal.row.status)}
                  </span>
                )}
              </div>

              {/* Curated Field Grid (No mid-word break-all) */}
              <div className={SECTION_CARD}>
                <div className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.06em] text-accent">
                  Record Attributes
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {Object.entries(modal.row)
                    .filter(([k]) => !INSPECT_HIDDEN_KEYS.has(k))
                    .map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-xl border border-white/8 bg-bg1/65 px-3 py-2"
                      >
                        <div className="font-mono text-[0.63rem] uppercase tracking-[0.05em] text-tl/65">
                          {INSPECT_LABELS[key] || key.replace(/_/g, " ")}
                        </div>
                        <div className="mt-0.5 break-words font-medium text-white">
                          {formatInspectValue(key, value)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Physical Copies Breakdown */}
              {Array.isArray(modal.row.copies) && modal.row.copies.length > 0 && (
                <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-accent" />
                      <span className="font-mono text-[0.7rem] font-bold uppercase text-white">
                        Physical Copies &amp; Accession Breakdown ({modal.row.copies.length})
                      </span>
                    </div>
                    <span className="text-[0.68rem] text-tl/70">
                      Tracks Good, Fair, Damaged, Destroyed, Lost &amp; Under Repair copies
                    </span>
                  </div>
                  <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
                    {(modal.row.copies as Record<string, unknown>[]).map((cp, i) => {
                      const cond = s(cp.condition || "Good");
                      return (
                        <div
                          key={i}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-bg1/80 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="whitespace-nowrap rounded-md border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-[0.7rem] font-bold text-accent">
                              {s(cp.accession_number)}
                            </span>
                            <span className="font-semibold text-white/90">
                              Copy #{s(cp.copy_number)}
                            </span>
                            {cp.condition_notes ? (
                              <span className="text-[0.68rem] text-tl/70">
                                — {s(cp.condition_notes)}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold ${getConditionBadgeTone(cond)}`}
                            >
                              {cond}
                            </span>
                            <span className="whitespace-nowrap font-mono text-[0.65rem] text-tl/65">
                              {s(cp.circulation_status)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Borrowed Books Breakdown on Library Card */}
              {Array.isArray(modal.row.books) && modal.row.books.length > 0 && (
                <div className={SECTION_CARD}>
                  <div className="font-mono text-[0.68rem] font-bold uppercase text-accent">
                    Borrowed Books ({modal.row.books.length})
                  </div>
                  <div className="space-y-1.5">
                    {(modal.row.books as Record<string, unknown>[]).map((b, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-white/8 bg-bg1/70 px-3 py-2"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {b.book_id ? `[#${s(b.book_id)}] ` : ""}
                            {s(b.book_title)}
                          </div>
                          <div className="text-[0.68rem] text-tl/70">
                            {s(b.book_author)} {b.book_isbn ? `· ISBN ${s(b.book_isbn)}` : ""}
                          </div>
                        </div>
                        <span className="rounded-md bg-accent2/15 px-2 py-0.5 font-mono font-bold text-accent2">
                          ×{s(b.quantity || 1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end border-t border-white/10 pt-3">
                <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                  Close Inspector
                </Button>
              </div>
            </div>
          )}

          {/* 2. DELETE MODAL */}
          {modal.type === "delete" && (
            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3.5 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-danger">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-danger/30 bg-danger/15">
                  <Trash2 className="h-4 w-4" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">
                    Permanently delete {resource.replace(/_/g, " ")} record #{s(modal.row.id)}?
                  </p>
                  <p className="font-medium text-danger">
                    {s(
                      modal.row.title ||
                        modal.row.book_title ||
                        modal.row.fullname ||
                        modal.row.borrower_name ||
                        modal.row.email ||
                        `Record #${s(modal.row.id)}`
                    )}
                  </p>
                  <p className="text-[0.7rem] text-tl/75">
                    {resource === "books"
                      ? "Deleting this catalog title will also remove its inventory summary and physical copy accession records."
                      : "This action is logged in the administrator audit trail and cannot be undone."}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2.5 border-t border-white/10 pt-3">
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
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete Permanently
                </Button>
              </div>
            </div>
          )}

          {/* 3. ACCOUNT REQUEST APPROVE / REJECT MODAL */}
          {modal.type === "review" && (
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div className={SECTION_CARD}>
                <div className="flex items-center justify-between border-b border-white/8 pb-2.5">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {s(modal.row.fullname) !== "—"
                        ? s(modal.row.fullname)
                        : `User #${s(modal.row.user_id)}`}
                    </div>
                    <div className="font-mono text-[0.72rem] text-accent">
                      {s(modal.row.email)}
                    </div>
                  </div>
                  <span className="rounded-full border border-accent/30 bg-accent/12 px-2.5 py-0.5 font-mono text-[0.66rem] font-bold uppercase text-accent">
                    {s(modal.row.request_type)}
                  </span>
                </div>
                {s(modal.row.reason) && (
                  <div className="rounded-xl border border-white/8 bg-bg1/65 p-3 text-tl/85">
                    <span className="block font-mono text-[0.62rem] uppercase text-tl/55">
                      Submitted Reason
                    </span>
                    <span className="mt-0.5 block">{s(modal.row.reason)}</span>
                  </div>
                )}
              </div>

              <div className={SECTION_CARD}>
                <label className={FIELD_LABEL}>
                  <span>Staff Decision Note</span>
                  <span className="font-normal lowercase text-tl/55">
                    delivered to patron notifications
                  </span>
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

              <div className="flex justify-end gap-2.5 border-t border-white/10 pt-3">
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

          {/* 4. RESET PASSWORD MODAL (With Show/Hide + Confirm + Live Policy Checklist) */}
          {modal.type === "reset_password" && (
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div className="flex items-center justify-between rounded-2xl border border-accent/25 bg-accent/[0.05] p-3.5">
                <div>
                  <div className="text-[0.68rem] uppercase tracking-[0.06em] text-tl/65">
                    Target Account
                  </div>
                  <div className="text-sm font-bold text-white">
                    {s(modal.row.fullname || modal.row.email)}
                  </div>
                </div>
                <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[0.7rem] text-accent">
                  #{s(modal.row.id)}
                </span>
              </div>

              <div className={SECTION_CARD}>
                <div>
                  <label className={FIELD_LABEL}>
                    <span>New Password *</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={s(form.new_password)}
                      onChange={(e) => setField("new_password", e.target.value)}
                      placeholder="Enter strong password"
                      className={`${INPUT_CLS} pr-9`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tl/60 hover:text-white cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={FIELD_LABEL}>
                    <span>Confirm New Password *</span>
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={INPUT_CLS}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {pwChecks.map((rule) => (
                    <span
                      key={rule.label}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.64rem] font-semibold ${
                        rule.ok
                          ? "border-accent2/35 bg-accent2/15 text-accent2"
                          : "border-white/10 bg-white/5 text-tl/55"
                      }`}
                    >
                      <Check className="h-2.5 w-2.5" />
                      {rule.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-white/10 pt-3">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="sm" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" />
                  )}
                  Update Password
                </Button>
              </div>
            </form>
          )}

          {/* 5. RETURN CARD BOOKS MODAL */}
          {modal.type === "return_card" && (
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div className={SECTION_CARD}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">
                      Card #{s(modal.row.id)} — {s(modal.row.fullname)}
                    </div>
                    <div className="mt-0.5 text-tl/70">
                      Logs returned items and restores available copies to book inventory
                    </div>
                  </div>
                  <span className="rounded-full border border-accent2/30 bg-accent2/12 px-2.5 py-0.5 font-mono text-[0.68rem] font-bold text-accent2">
                    {Array.isArray(modal.row.books) ? modal.row.books.length : 0} item(s)
                  </span>
                </div>

                {Array.isArray(modal.row.books) && modal.row.books.length > 0 && (
                  <div className="space-y-1.5 border-t border-white/8 pt-2.5">
                    {(modal.row.books as Record<string, unknown>[]).map((b, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-white/8 bg-bg1/70 px-3 py-2"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {b.book_id ? `[#${s(b.book_id)}] ` : ""}
                            {s(b.book_title)}
                          </div>
                          <div className="text-[0.68rem] text-tl/65">{s(b.book_author)}</div>
                        </div>
                        <span className="font-mono font-bold text-accent2">
                          ×{s(b.quantity || 1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className={FIELD_LABEL}>
                    <span>Return Date *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={s(form.return_date)}
                    onChange={(e) => setField("return_date", e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-white/10 pt-3">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="sm" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Confirm Return
                </Button>
              </div>
            </form>
          )}

          {/* 6. CREATE BOOK MODAL (AddBookModal) */}
          {modal.type === "create" && resource === "books" && (
            <AddBookModal
              open
              onClose={onClose}
              onSubmit={async (payload: AddBookWithCopiesInput) => {
                await submitMutation("POST", "create", null, {
                  ...payload,
                  volumes: payload.copies_to_add,
                  available_copies: payload.copies_to_add,
                });
              }}
            />
          )}

          {/* 7. CREATE / EDIT FORMS FOR ALL OTHER RESOURCES */}
          {(modal.type === "create" || modal.type === "edit") &&
            !(modal.type === "create" && resource === "books") && (
              <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
                {/* EDIT BOOK FORM (Two-Section Layout + Per-Copy Destroyed/Damaged Editor) */}
                {resource === "books" && (
                  <>
                    <div className={SECTION_CARD}>
                      <div className="flex items-center justify-between border-b border-white/8 pb-2.5">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-accent" />
                          <span className="font-bold text-white">Bibliographic Details</span>
                        </div>
                        <span className="rounded-md border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-[0.68rem] font-bold text-accent">
                          Book ID #{s(form.id)}
                        </span>
                      </div>

                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className={FIELD_LABEL}>
                            <span>ISBN-10 / ISBN-13 (Optional)</span>
                          </label>
                          <div className="relative">
                            <Barcode className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tl/45" />
                            <input
                              value={s(form.isbn)}
                              onChange={(e) => setField("isbn", e.target.value)}
                              placeholder="9780140449136 (optional)"
                              className={`${INPUT_CLS} pl-8 font-mono`}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={lookingUp}
                          onClick={handleIsbnLookup}
                        >
                          {lookingUp ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 text-accent" />
                          )}
                          Auto-Fill ISBN
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Book Title *</span>
                          </label>
                          <input
                            required
                            value={s(form.title)}
                            onChange={(e) => setField("title", e.target.value)}
                            className={INPUT_CLS}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Author(s) *</span>
                          </label>
                          <input
                            required
                            value={s(form.author)}
                            onChange={(e) => setField("author", e.target.value)}
                            className={INPUT_CLS}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Call / Catalog Code</span>
                          </label>
                          <div className="relative">
                            <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tl/45" />
                            <input
                              value={s(form.call_number)}
                              onChange={(e) => setField("call_number", e.target.value)}
                              placeholder="QA76.73"
                              className={`${INPUT_CLS} pl-7 font-mono`}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Collection Category</span>
                          </label>
                          <input
                            value={s(form.category)}
                            onChange={(e) => setField("category", e.target.value)}
                            className={INPUT_CLS}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Class / Genre</span>
                          </label>
                          <input
                            value={s(form.class)}
                            onChange={(e) => setField("class", e.target.value)}
                            className={INPUT_CLS}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Publisher</span>
                          </label>
                          <input
                            value={s(form.publisher)}
                            onChange={(e) => setField("publisher", e.target.value)}
                            className={INPUT_CLS}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Published Date</span>
                          </label>
                          <input
                            value={s(form.published_date)}
                            onChange={(e) => setField("published_date", e.target.value)}
                            className={`${INPUT_CLS} font-mono`}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Source of Fund</span>
                          </label>
                          <input
                            value={s(form.source_of_fund)}
                            onChange={(e) => setField("source_of_fund", e.target.value)}
                            className={INPUT_CLS}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Stock Counts & Individual Physical Copies */}
                    <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-4 space-y-3.5">
                      <div className="flex items-center justify-between border-b border-white/8 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-accent2" />
                          <span className="font-bold text-white">
                            Stock Counts &amp; Physical Copy Conditions
                          </span>
                        </div>
                        <span className="font-mono text-[0.68rem] text-tl/70">
                          Supports Good, Fair, Damaged, Destroyed, Lost &amp; Under Repair
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-6">
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Total</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={s(form.volumes)}
                            onChange={(e) => setField("volumes", Number(e.target.value))}
                            className={`${INPUT_CLS} font-mono`}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Available</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={s(form.available_copies)}
                            onChange={(e) => setField("available_copies", Number(e.target.value))}
                            className={`${INPUT_CLS} font-mono text-accent2`}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Damaged</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={s(form.damaged_copies)}
                            onChange={(e) => setField("damaged_copies", Number(e.target.value))}
                            className={`${INPUT_CLS} font-mono text-warn`}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Destroyed</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={s(form.destroyed_copies)}
                            onChange={(e) => setField("destroyed_copies", Number(e.target.value))}
                            className={`${INPUT_CLS} font-mono text-danger`}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Lost</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={s(form.lost_copies)}
                            onChange={(e) => setField("lost_copies", Number(e.target.value))}
                            className={`${INPUT_CLS} font-mono text-danger`}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Shelf</span>
                          </label>
                          <input
                            value={s(form.shelf_location)}
                            onChange={(e) => setField("shelf_location", e.target.value)}
                            placeholder="A-Row 2"
                            className={INPUT_CLS}
                          />
                        </div>
                      </div>

                      {editableCopies.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="font-mono text-[0.66rem] uppercase text-tl/70">
                            Individual Copy Conditions ({editableCopies.length} copies)
                          </div>
                          <div className="max-h-[185px] space-y-1.5 overflow-y-auto pr-1">
                            {editableCopies.map((cp, idx) => {
                              const cond = s(cp.condition || "Good") as CopyCondition;
                              return (
                                <div
                                  key={idx}
                                  className="grid grid-cols-1 gap-2 rounded-xl border border-white/8 bg-bg1/80 px-3 py-2 sm:grid-cols-12 sm:items-center"
                                >
                                  <div className="flex items-center gap-2 sm:col-span-4">
                                    <span className="whitespace-nowrap rounded border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-[0.68rem] font-bold text-accent">
                                      {s(cp.accession_number)}
                                    </span>
                                    <span className="whitespace-nowrap text-white/85">
                                      Copy #{s(cp.copy_number)}
                                    </span>
                                  </div>
                                  <div className="sm:col-span-3">
                                    <select
                                      value={cond}
                                      onChange={(e) =>
                                        handleCopyConditionChange(
                                          idx,
                                          e.target.value as CopyCondition
                                        )
                                      }
                                      className="w-full rounded-lg border border-white/12 bg-bg1 px-2 py-1 text-[0.72rem] font-semibold text-white focus:border-accent focus:outline-none"
                                    >
                                      {COPY_CONDITIONS.map((c) => (
                                        <option key={c} value={c} className="bg-modal text-white">
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="sm:col-span-5">
                                    <input
                                      value={s(cp.condition_notes)}
                                      onChange={(e) => handleCopyNotesChange(idx, e.target.value)}
                                      placeholder="Condition note (e.g. torn cover, destroyed)"
                                      className="w-full rounded-lg border border-white/10 bg-bg1/60 px-2.5 py-1 text-[0.7rem] text-white placeholder:text-tl/40 focus:border-accent focus:outline-none"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <label className="flex items-center gap-2.5 pt-1 text-tl cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(form.is_borrowable)}
                          onChange={(e) => setField("is_borrowable", e.target.checked)}
                          className="accent-[var(--accent2)]"
                        />
                        <span className="font-medium text-white">
                          Available for Patron Borrowing
                        </span>
                      </label>
                    </div>
                  </>
                )}

                {/* INVENTORY EDIT FORM (With Destroyed Copies & Interactive Per-Copy Condition Switcher) */}
                {resource === "inventory" && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/25 bg-accent/[0.05] p-3.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-accent/30 bg-accent/15 px-2 py-0.5 font-mono text-[0.68rem] font-bold text-accent">
                            Book ID #{s(form.book_id)}
                          </span>
                          <span className="font-bold text-white">{s(form.book_title)}</span>
                        </div>
                        {form.book_author ? (
                          <div className="mt-0.5 text-[0.7rem] text-tl/70">
                            {s(form.book_author)} {form.isbn ? `· ISBN ${s(form.isbn)}` : ""}
                          </div>
                        ) : null}
                      </div>
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[0.68rem] text-tl/80">
                        Inv #{s(form.id)}
                      </span>
                    </div>

                    <div className={SECTION_CARD}>
                      <div className="font-mono text-[0.68rem] font-bold uppercase text-accent">
                        Aggregate Copy Counts &amp; Location
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Total Copies</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={s(form.volumes)}
                            onChange={(e) => setField("volumes", Number(e.target.value))}
                            className={`${INPUT_CLS} font-mono`}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Available</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={s(form.available_copies)}
                            onChange={(e) => setField("available_copies", Number(e.target.value))}
                            className={`${INPUT_CLS} font-mono text-accent2`}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Damaged</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={s(form.damaged_copies)}
                            onChange={(e) => setField("damaged_copies", Number(e.target.value))}
                            className={`${INPUT_CLS} font-mono text-warn`}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Destroyed</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={s(form.destroyed_copies)}
                            onChange={(e) => setField("destroyed_copies", Number(e.target.value))}
                            className={`${INPUT_CLS} font-mono text-danger`}
                          />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Lost</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={s(form.lost_copies)}
                            onChange={(e) => setField("lost_copies", Number(e.target.value))}
                            className={`${INPUT_CLS} font-mono text-danger`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Shelf Location</span>
                          </label>
                          <div className="relative">
                            <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tl/45" />
                            <input
                              value={s(form.shelf_location)}
                              onChange={(e) => setField("shelf_location", e.target.value)}
                              placeholder="A-Row 2"
                              className={`${INPUT_CLS} pl-7`}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>
                            <span>Circulation Status</span>
                          </label>
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
                    </div>

                    {editableCopies.length > 0 && (
                      <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-4 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-accent" />
                            <span className="font-mono text-[0.7rem] font-bold uppercase text-white">
                              Per-Copy Condition Inspector ({editableCopies.length} copies)
                            </span>
                          </div>
                          <span className="text-[0.68rem] text-tl/70">
                            Changing a copy condition updates Available / Damaged / Destroyed / Lost counts
                          </span>
                        </div>

                        <div className="max-h-[210px] space-y-1.5 overflow-y-auto pr-1">
                          {editableCopies.map((cp, idx) => {
                            const cond = s(cp.condition || "Good") as CopyCondition;
                            return (
                              <div
                                key={idx}
                                className="grid grid-cols-1 gap-2 rounded-xl border border-white/8 bg-bg1/80 px-3 py-2 sm:grid-cols-12 sm:items-center"
                              >
                                <div className="flex items-center gap-2 sm:col-span-4">
                                  <span className="whitespace-nowrap rounded border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-[0.68rem] font-bold text-accent">
                                    {s(cp.accession_number)}
                                  </span>
                                  <span className="whitespace-nowrap text-white/85">
                                    Copy #{s(cp.copy_number)}
                                  </span>
                                </div>
                                <div className="sm:col-span-3">
                                  <select
                                    value={cond}
                                    onChange={(e) =>
                                      handleCopyConditionChange(idx, e.target.value as CopyCondition)
                                    }
                                    className="w-full rounded-lg border border-white/12 bg-bg1 px-2 py-1 text-[0.72rem] font-semibold text-white focus:border-accent focus:outline-none"
                                  >
                                    {COPY_CONDITIONS.map((c) => (
                                      <option key={c} value={c} className="bg-modal text-white">
                                        {c}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="sm:col-span-5">
                                  <input
                                    value={s(cp.condition_notes)}
                                    onChange={(e) => handleCopyNotesChange(idx, e.target.value)}
                                    placeholder="Condition note (e.g. water damage, destroyed)"
                                    className="w-full rounded-lg border border-white/10 bg-bg1/60 px-2.5 py-1 text-[0.7rem] text-white placeholder:text-tl/40 focus:border-accent focus:outline-none"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* USERS / LIBRARIANS / ADMINS CREATE FORM */}
                {(resource === "users" || resource === "librarians" || resource === "admins") && (
                  <div className={SECTION_CARD}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>First Name *</span>
                        </label>
                        <input
                          required
                          value={s(form.firstname)}
                          onChange={(e) => setField("firstname", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Last Name *</span>
                        </label>
                        <input
                          required
                          value={s(form.lastname)}
                          onChange={(e) => setField("lastname", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={FIELD_LABEL}>
                          <span>Email Address *</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={s(form.email)}
                          onChange={(e) => setField("email", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Password *</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required={modal.type === "create"}
                            value={s(form.password)}
                            onChange={(e) => setField("password", e.target.value)}
                            placeholder="Min 8 chars + upper, lower, digit, symbol"
                            className={`${INPUT_CLS} pr-9`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tl/60 hover:text-white cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Confirm Password *</span>
                        </label>
                        <input
                          type={showPassword ? "text" : "password"}
                          required={modal.type === "create"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Gender</span>
                        </label>
                        <select
                          value={s(form.gender)}
                          onChange={(e) => setField("gender", e.target.value)}
                          className={INPUT_CLS}
                        >
                          <option value="" className="bg-modal text-white">
                            Select
                          </option>
                          <option value="Male" className="bg-modal text-white">
                            Male
                          </option>
                          <option value="Female" className="bg-modal text-white">
                            Female
                          </option>
                          <option value="Others" className="bg-modal text-white">
                            Others
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Phone Number</span>
                        </label>
                        <input
                          value={s(form.phone_number)}
                          onChange={(e) => setField("phone_number", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                    </div>

                    {modal.type === "create" && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {pwChecks.map((rule) => (
                          <span
                            key={rule.label}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.64rem] font-semibold ${
                              rule.ok
                                ? "border-accent2/35 bg-accent2/15 text-accent2"
                                : "border-white/10 bg-white/5 text-tl/55"
                            }`}
                          >
                            <Check className="h-2.5 w-2.5" />
                            {rule.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* LIBRARY CARDS FORM */}
                {resource === "library_cards" && (
                  <div className={SECTION_CARD}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Borrower Category</span>
                        </label>
                        <select
                          value={s(form.card_type_category) || "member"}
                          onChange={(e) => setField("card_type_category", e.target.value)}
                          className={INPUT_CLS}
                        >
                          <option value="member" className="bg-modal text-white">
                            Registered Member
                          </option>
                          <option value="borrower" className="bg-modal text-white">
                            Walk-In Borrower
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Card Type</span>
                        </label>
                        <select
                          value={s(form.card_type) || "regular"}
                          onChange={(e) => setField("card_type", e.target.value)}
                          className={INPUT_CLS}
                        >
                          <option value="regular" className="bg-modal text-white">
                            Regular (1-Year Validity)
                          </option>
                          <option value="city_govt" className="bg-modal text-white">
                            LGU / City Government Employee
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>First Name *</span>
                        </label>
                        <input
                          required
                          value={s(form.firstname)}
                          onChange={(e) => setField("firstname", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Last Name *</span>
                        </label>
                        <input
                          required
                          value={s(form.lastname)}
                          onChange={(e) => setField("lastname", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Phone Number</span>
                        </label>
                        <input
                          value={s(form.phone_number)}
                          onChange={(e) => setField("phone_number", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Address</span>
                        </label>
                        <input
                          value={s(form.address)}
                          onChange={(e) => setField("address", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Date Issued</span>
                        </label>
                        <input
                          type="date"
                          value={s(form.date_issued)}
                          onChange={(e) => setField("date_issued", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Due / Return Date</span>
                        </label>
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
                            <label className={FIELD_LABEL}>
                              <span>Borrowed Book</span>
                            </label>
                            <select
                              value={s(form.book_id)}
                              onChange={(e) => setField("book_id", e.target.value)}
                              className={INPUT_CLS}
                            >
                              <option value="" className="bg-modal text-white">
                                Select catalog title...
                              </option>
                              {auxBooks.map((b) => (
                                <option key={s(b.id)} value={s(b.id)} className="bg-modal text-white">
                                  Book ID #{s(b.id)} — {s(b.title).slice(0, 40)} ({s(b.available_copies)} avail)
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={FIELD_LABEL}>
                              <span>Quantity</span>
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={s(form.quantity || 1)}
                              onChange={(e) => setField("quantity", Number(e.target.value))}
                              className={`${INPUT_CLS} font-mono`}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* RETURNS FORM */}
                {resource === "returns" && (
                  <div className={SECTION_CARD}>
                    <div>
                      <label className={FIELD_LABEL}>
                        <span>Select Active Borrowing Card *</span>
                      </label>
                      <select
                        required
                        value={s(form.card_id)}
                        onChange={(e) => setField("card_id", e.target.value)}
                        className={INPUT_CLS}
                      >
                        <option value="" className="bg-modal text-white">
                          Choose a card with borrowed books...
                        </option>
                        {auxCards
                          .filter((c) => Number(c.books_count ?? 0) > 0)
                          .map((c) => (
                            <option key={s(c.id)} value={s(c.id)} className="bg-modal text-white">
                              Card #{s(c.id)} — {s(c.fullname)} ({s(c.books_count)} book(s))
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>
                        <span>Return Date *</span>
                      </label>
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
                  <div className={SECTION_CARD}>
                    <div>
                      <label className={FIELD_LABEL}>
                        <span>Event Title *</span>
                      </label>
                      <input
                        required
                        value={s(form.title)}
                        onChange={(e) => setField("title", e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Event Date *</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={s(form.event_date)}
                          onChange={(e) => setField("event_date", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Category</span>
                        </label>
                        <select
                          value={s(form.category) || "general"}
                          onChange={(e) => setField("category", e.target.value)}
                          className={INPUT_CLS}
                        >
                          {["general", "event", "meeting", "holiday", "reminder", "urgent"].map(
                            (cat) => (
                              <option
                                key={cat}
                                value={cat}
                                className="bg-modal text-white capitalize"
                              >
                                {cat}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Start Time</span>
                        </label>
                        <input
                          type="time"
                          value={s(form.start_time)}
                          onChange={(e) => setField("start_time", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>End Time</span>
                        </label>
                        <input
                          type="time"
                          value={s(form.end_time)}
                          onChange={(e) => setField("end_time", e.target.value)}
                          className={INPUT_CLS}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>
                        <span>Location</span>
                      </label>
                      <input
                        value={s(form.location)}
                        onChange={(e) => setField("location", e.target.value)}
                        placeholder="Iloilo City Public Library Main Hall"
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>
                        <span>Description</span>
                      </label>
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
                  <div className={SECTION_CARD}>
                    <div>
                      <label className={FIELD_LABEL}>
                        <span>Notice Title *</span>
                        <span className="font-mono text-[0.63rem] text-tl/55">
                          {s(form.title).length}/120
                        </span>
                      </label>
                      <input
                        required
                        maxLength={120}
                        value={s(form.title)}
                        onChange={(e) => setField("title", e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                      <div>
                        <label className={FIELD_LABEL}>
                          <span>Category</span>
                        </label>
                        <select
                          value={s(form.category) || "general"}
                          onChange={(e) => setField("category", e.target.value)}
                          className={INPUT_CLS}
                        >
                          {["general", "urgent", "event", "reminder"].map((cat) => (
                            <option
                              key={cat}
                              value={cat}
                              className="bg-modal text-white capitalize"
                            >
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-bg1/85 px-3 py-2 text-xs text-tl cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(form.pinned)}
                          onChange={(e) => setField("pinned", e.target.checked)}
                          className="accent-[var(--accent)]"
                        />
                        <span className="font-medium text-white">Pin announcement to top</span>
                      </label>
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>
                        <span>Message Body *</span>
                      </label>
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

                <div className="flex justify-end gap-2.5 border-t border-white/10 pt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="accent" size="sm" disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
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
