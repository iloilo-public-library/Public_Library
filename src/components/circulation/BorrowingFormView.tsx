"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  CreditCard,
  Image as ImageIcon,
  Loader2,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Upload,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { apiMutate, swrPrivateConfig } from "@/lib/api";
import {
  CIRCULATION_POLICY,
  type CatalogBook,
  type CatalogBookCopy,
  type CirculationToast,
  type LibraryCardRow,
  type PickerMember,
  addDaysToIsoDate,
  computeAutoValidUntil,
  formatPhp,
  getManilaLongDate,
  getManilaTodayISO,
} from "./types";
import "./circulation.css";

interface SelectedBookEntry {
  key: string;
  book: CatalogBook;
  copy_id: number | null;
  accession_number?: string;
  quantity: number;
}

interface ReceiptBookItem {
  bookId: number;
  title: string;
  author: string;
  isbn: string;
  accessionNumber?: string;
  quantity: number;
}

interface ReceiptData {
  cardId: number;
  category: "member" | "borrower";
  fullname: string;
  dateIssued: string;
  dateReturn: string;
  cardType: string;
  validUntil: string;
  books: ReceiptBookItem[];
}

export interface BorrowingFormViewProps {
  role?: "admin" | "librarian";
  canBorrow?: boolean;
}

function isBorrowableCopy(cp: CatalogBookCopy): boolean {
  const statusOk = String(cp.circulation_status ?? "Available") === "Available";
  const cond = String(cp.condition ?? "Good");
  const condOk = cond === "Good" || cond === "Fair";
  return statusOk && condOk && cp.is_borrowable !== false;
}

function getAvailableCopyCount(b: CatalogBook): number {
  if (Array.isArray(b.copies) && b.copies.length > 0) {
    return b.copies.filter(isBorrowableCopy).length;
  }
  if (b.is_borrowable === false) return 0;
  return Math.max(0, Number(b.available_copies ?? 0));
}

function formatBorrowErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("unpaid fine")) {
    return `Borrowing blocked: ${raw} Record payment or request an admin waiver before issuing a new loan.`;
  }
  if (lower.includes("maximum") || lower.includes("limit") || lower.includes("5 book")) {
    return `Borrowing limit reached: ${raw}`;
  }
  if (lower.includes("expired")) {
    return `Library card expired: ${raw}`;
  }
  return raw;
}

export function BorrowingFormView({
  role = "admin",
  canBorrow = true,
}: BorrowingFormViewProps = {}) {
  const todayISO = useMemo(() => getManilaTodayISO(), []);
  const todayLong = useMemo(() => getManilaLongDate(), []);
  const isAdmin = role === "admin";
  const isLibrarian = role === "librarian";

  const [tab, setTab] = useState<"member" | "borrower">("member");

  // Member search combobox
  const [memberQuery, setMemberQuery] = useState("");
  const [debouncedMemberQ, setDebouncedMemberQ] = useState("");
  const [memberDropOpen, setMemberDropOpen] = useState(false);
  const [memberHighlight, setMemberHighlight] = useState(0);
  const [selectedMember, setSelectedMember] = useState<PickerMember | null>(null);

  // Personal fields
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Multi-book picker (supports Book ID, title, author, ISBN, and accession scan)
  const [bookQuery, setBookQuery] = useState("");
  const [debouncedBookQ, setDebouncedBookQ] = useState("");
  const [bookDropOpen, setBookDropOpen] = useState(false);
  const [bookHighlight, setBookHighlight] = useState(0);
  const [selectedBooks, setSelectedBooks] = useState<SelectedBookEntry[]>([]);

  // Card & dates (server-owned unless admin backdating)
  const [cardType, setCardType] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [adminBackdate, setAdminBackdate] = useState(false);
  const [backdateIssued, setBackdateIssued] = useState(todayISO);
  const [backdateReason, setBackdateReason] = useState("");

  // 1x1 card photo upload
  const [photoPath, setPhotoPath] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Confirm modal, submission, receipt, toast
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [toast, setToast] = useState<CirculationToast | null>(null);

  const memberComboRef = useRef<HTMLDivElement>(null);
  const bookComboRef = useRef<HTMLDivElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const confirmModalRef = useRef<HTMLDivElement>(null);

  const effectiveIssueISO = isAdmin && adminBackdate && backdateIssued ? backdateIssued : todayISO;
  const expectedDueISO = useMemo(
    () => addDaysToIsoDate(effectiveIssueISO, CIRCULATION_POLICY.DEFAULT_LOAN_DAYS),
    [effectiveIssueISO]
  );

  // Cmd/Ctrl+K shortcut focuses book search
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        bookInputRef.current?.focus();
        if (bookQuery.trim()) setBookDropOpen(true);
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, [bookQuery]);

  // Focus trap and Esc close for confirmation modal
  useEffect(() => {
    if (!confirmOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    confirmModalRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        e.preventDefault();
        setConfirmOpen(false);
        return;
      }
      if (e.key === "Tab" && confirmModalRef.current) {
        const focusable = confirmModalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
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
  }, [confirmOpen, submitting]);

  // Debounce member & book searches (280ms)
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedMemberQ(memberQuery.trim()), 280);
    return () => window.clearTimeout(t);
  }, [memberQuery]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedBookQ(bookQuery.trim().toLowerCase()), 280);
    return () => window.clearTimeout(t);
  }, [bookQuery]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Close dropdowns on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (memberComboRef.current && !memberComboRef.current.contains(e.target as Node)) {
        setMemberDropOpen(false);
      }
      if (bookComboRef.current && !bookComboRef.current.contains(e.target as Node)) {
        setBookDropOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const showToast = useCallback((message: string, tone: CirculationToast["tone"] = "info") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  // Live member picker (minimal fields only)
  const { data: memberData, isLoading: memberLoading } = useSWR<{ users?: PickerMember[] }>(
    tab === "member" && debouncedMemberQ.length > 0
      ? `/api/admin/users?role=member&mode=picker&limit=20&q=${encodeURIComponent(debouncedMemberQ)}`
      : null,
    swrPrivateConfig
  );

  // Catalog books (cached base + live server search)
  const {
    data: booksData,
    isLoading: baseBooksLoading,
    mutate: mutateBooks,
  } = useSWR<{ rows?: CatalogBook[] }>(
    "/api/admin/data?resource=books&pageSize=200",
    swrPrivateConfig
  );

  const { data: liveBooksData, isLoading: liveBooksLoading } = useSWR<{ rows?: CatalogBook[] }>(
    debouncedBookQ.length > 0
      ? `/api/admin/data?resource=books&pageSize=30&q=${encodeURIComponent(debouncedBookQ)}`
      : null,
    swrPrivateConfig
  );

  const { data: cardsData, mutate: mutateCards } = useSWR<{ rows?: LibraryCardRow[] }>(
    "/api/admin/data?resource=library_cards&pageSize=200",
    swrPrivateConfig
  );

  const memberResults = useMemo(() => memberData?.users ?? [], [memberData?.users]);
  const allBooks = useMemo(() => {
    const byId = new Map<number, CatalogBook>();
    for (const b of booksData?.rows ?? []) byId.set(b.id, b);
    for (const b of liveBooksData?.rows ?? []) byId.set(b.id, b);
    return Array.from(byId.values());
  }, [booksData?.rows, liveBooksData?.rows]);
  const booksLoading = baseBooksLoading || liveBooksLoading;

  const filteredBooks = useMemo(() => {
    if (!debouncedBookQ) return [];
    const cleanIdQ = debouncedBookQ.replace(/^#/, "");
    const numericMatch = /^\d+$/.test(cleanIdQ) ? cleanIdQ : "";
    return allBooks
      .filter(
        (b) =>
          (numericMatch && String(b.id) === numericMatch) ||
          (b.title || "").toLowerCase().includes(debouncedBookQ) ||
          (b.author || "").toLowerCase().includes(debouncedBookQ) ||
          (b.isbn || "").toLowerCase().includes(debouncedBookQ) ||
          (b.catalog_code || "").toLowerCase().includes(debouncedBookQ) ||
          (b.copies ?? []).some((cp) =>
            (cp.accession_number || "").toLowerCase().includes(debouncedBookQ)
          )
      )
      .slice(0, 25);
  }, [allBooks, debouncedBookQ]);

  const { memberBorrowedCount, memberUnpaidFine } = useMemo(() => {
    if (!selectedMember) return { memberBorrowedCount: 0, memberUnpaidFine: 0 };
    let activeCount = 0;
    let unpaidFine = 0;
    for (const c of cardsData?.rows ?? []) {
      if (c.user_id !== selectedMember.id) continue;
      if (!c.fine_waived && Number(c.fine_amount ?? 0) > 0) {
        unpaidFine += Number(c.fine_amount ?? 0);
      }
      if (c.is_returned) continue;
      const activeCardBooks = (c.books ?? []).filter((b) => {
        const ls = String(b.loan_status ?? "borrowed");
        return ls === "borrowed" || ls === "overdue";
      });
      if (activeCardBooks.length > 0) {
        activeCount += activeCardBooks.reduce((s, b) => s + Math.max(1, Number(b.quantity ?? 1) || 1), 0);
      } else if (c.status !== "lost") {
        activeCount += Math.max(0, Number(c.books_count ?? 0));
      }
    }
    return {
      memberBorrowedCount: activeCount,
      memberUnpaidFine: Number(unpaidFine.toFixed(2)),
    };
  }, [cardsData?.rows, selectedMember]);

  const memberBlockedReason = useMemo(() => {
    if (!selectedMember) return null;
    if (selectedMember.is_active === false) return "Member account is inactive.";
    if (selectedMember.is_approved === false) return "Member account is pending approval.";
    if (memberUnpaidFine >= CIRCULATION_POLICY.BLOCKING_UNPAID_FINE_PHP) {
      return `Member has ${formatPhp(memberUnpaidFine)} in unpaid fines. Settle or waive fines before issuing new books.`;
    }
    if (memberBorrowedCount >= CIRCULATION_POLICY.MAX_ACTIVE_BORROWS) {
      return `Member has reached the ${CIRCULATION_POLICY.MAX_ACTIVE_BORROWS}-book active borrow limit.`;
    }
    return null;
  }, [selectedMember, memberUnpaidFine, memberBorrowedCount]);

  const maxAddable = useMemo(() => {
    if (tab === "member" && selectedMember) {
      return Math.max(0, CIRCULATION_POLICY.MAX_ACTIVE_BORROWS - memberBorrowedCount);
    }
    return CIRCULATION_POLICY.MAX_ACTIVE_BORROWS;
  }, [tab, selectedMember, memberBorrowedCount]);

  const selectedTotalQty = useMemo(
    () => selectedBooks.reduce((sum, entry) => sum + entry.quantity, 0),
    [selectedBooks]
  );

  const getSelectedQtyForBook = useCallback(
    (bookId: number) =>
      selectedBooks
        .filter((entry) => entry.book.id === bookId)
        .reduce((s, entry) => s + entry.quantity, 0),
    [selectedBooks]
  );

  const stockProblemEntry = useMemo(() => {
    return selectedBooks.find((entry) => getSelectedQtyForBook(entry.book.id) > getAvailableCopyCount(entry.book)) ?? null;
  }, [selectedBooks, getSelectedQtyForBook]);

  const limitExceeded =
    (tab === "member"
      ? memberBorrowedCount + selectedTotalQty > CIRCULATION_POLICY.MAX_ACTIVE_BORROWS
      : selectedTotalQty > CIRCULATION_POLICY.MAX_ACTIVE_BORROWS);

  const handleSelectMember = (m: PickerMember) => {
    setSelectedMember(m);
    const parts = (m.fullname || "").trim().split(/\s+/);
    setFirstname(m.firstname || parts[0] || "");
    setLastname(m.lastname || parts.slice(1).join(" ") || "");
    setMemberQuery(m.fullname || `${m.firstname ?? ""} ${m.lastname ?? ""}`.trim());
    setMemberDropOpen(false);
    setFormError(null);
  };

  const handleClearMember = () => {
    setSelectedMember(null);
    setMemberQuery("");
    setFirstname("");
    setLastname("");
    setPhone("");
    setAddress("");
  };

  const handleAddBook = (b: CatalogBook, specificCopy?: CatalogBookCopy) => {
    const avail = getAvailableCopyCount(b);
    if (avail <= 0) {
      showToast(`"${b.title}" has no borrowable copies available.`, "danger");
      return;
    }
    if (selectedTotalQty + 1 > maxAddable) {
      const msg =
        tab === "member" && selectedMember
          ? `Borrow limit exceeded: ${memberBorrowedCount} active + ${selectedTotalQty} selected reaches the ${CIRCULATION_POLICY.MAX_ACTIVE_BORROWS}-book limit.`
          : `Borrow limit exceeded: maximum ${CIRCULATION_POLICY.MAX_ACTIVE_BORROWS} books per card.`;
      setFormError(msg);
      showToast(msg, "danger");
      return;
    }
    const alreadyForBook = getSelectedQtyForBook(b.id);
    if (alreadyForBook + 1 > avail) {
      showToast(`All ${avail} borrowable copy/copies of "${b.title}" are already selected.`, "danger");
      return;
    }

    if (specificCopy?.id) {
      if (!isBorrowableCopy(specificCopy)) {
        showToast("This copy is not available or not in Good/Fair condition.", "danger");
        return;
      }
      const copyKey = `copy:${specificCopy.id}`;
      if (selectedBooks.some((e) => e.key === copyKey)) {
        showToast(`Copy ${specificCopy.accession_number || `#${specificCopy.id}`} is already selected.`, "info");
        return;
      }
      setSelectedBooks((prev) => [
        ...prev,
        {
          key: copyKey,
          book: b,
          copy_id: Number(specificCopy.id),
          accession_number: specificCopy.accession_number,
          quantity: 1,
        },
      ]);
    } else {
      const genericKey = `book:${b.id}`;
      setSelectedBooks((prev) => {
        const idx = prev.findIndex((e) => e.key === genericKey);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return next;
        }
        return [...prev, { key: genericKey, book: b, copy_id: null, quantity: 1 }];
      });
    }

    setBookQuery("");
    setBookDropOpen(false);
    setFormError(null);
  };

  const handleUpdateEntryQty = (key: string, nextQty: number) => {
    const safeNext = Math.max(1, Math.trunc(nextQty) || 1);
    setSelectedBooks((prev) =>
      prev.map((entry) => {
        if (entry.key !== key || entry.copy_id !== null) return entry;
        const otherTotal = prev
          .filter((e) => e.key !== key)
          .reduce((s, e) => s + e.quantity, 0);
        const otherSameBook = prev
          .filter((e) => e.key !== key && e.book.id === entry.book.id)
          .reduce((s, e) => s + e.quantity, 0);
        const capByStock = Math.max(1, getAvailableCopyCount(entry.book) - otherSameBook);
        const capByLimit = Math.max(1, maxAddable - otherTotal);
        return { ...entry, quantity: Math.min(safeNext, capByStock, capByLimit) };
      })
    );
  };

  const handleRemoveEntry = (key: string) => {
    setSelectedBooks((prev) => prev.filter((e) => e.key !== key));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);

    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(file.type)) {
      setPhotoError("Invalid file type. Please choose a JPEG, PNG, or WebP image.");
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("Photo must be 2 MB or smaller.");
      e.target.value = "";
      return;
    }

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("folder", "card-photos");
      formData.append("file", file);

      const res = await fetch("/api/storage/upload", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        path?: string;
        url?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to upload card photo.");
      }

      const storedPath = json.path || json.url || "";
      setPhotoPath(storedPath);
      setPhotoPreviewUrl(json.url || URL.createObjectURL(file));
      showToast("1×1 card photo uploaded.", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Photo upload failed.";
      setPhotoError(msg);
      showToast(msg, "danger");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const handleClearPhoto = () => {
    setPhotoPath("");
    setPhotoPreviewUrl("");
    setPhotoError(null);
  };

  const handleReset = () => {
    handleClearMember();
    setSelectedBooks([]);
    setBookQuery("");
    setCardType("");
    setValidUntil("");
    setAdminBackdate(false);
    setBackdateIssued(todayISO);
    setBackdateReason("");
    handleClearPhoto();
    setFormError(null);
    setReceipt(null);
  };

  const handleSwitchTab = (next: "member" | "borrower") => {
    setTab(next);
    setFormError(null);
    setMemberDropOpen(false);
    setBookDropOpen(false);
    if (next === "borrower") {
      setSelectedMember(null);
      setMemberQuery("");
    }
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (tab === "member" && !selectedMember) {
      setFormError("Please search and select a registered member first.");
      return;
    }
    if (!firstname.trim() || !lastname.trim()) {
      setFormError("First name and last name are required.");
      return;
    }
    if (!cardType) {
      setFormError("Please select a Card Type.");
      return;
    }
    if (selectedBooks.length === 0) {
      setFormError("Please select at least one available book to borrow.");
      return;
    }
    if (stockProblemEntry) {
      const avail = getAvailableCopyCount(stockProblemEntry.book);
      setFormError(
        `Cannot register — requested quantity for "${stockProblemEntry.book.title}" exceeds available Good/Fair copies (${avail}).`
      );
      return;
    }
    if (limitExceeded) {
      setFormError(
        `Borrow limit exceeded: maximum ${CIRCULATION_POLICY.MAX_ACTIVE_BORROWS} active borrowed books allowed.`
      );
      return;
    }
    if (memberBlockedReason) {
      setFormError(memberBlockedReason);
      return;
    }
    if (isAdmin && adminBackdate) {
      if (!backdateIssued || backdateIssued > todayISO) {
        setFormError("Backdate issue date must be today or earlier.");
        return;
      }
      if (backdateReason.trim().length < 3) {
        setFormError("Admin backdating requires a reason (at least 3 characters).");
        return;
      }
    }
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (selectedBooks.length === 0) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const bookIdsPayload = selectedBooks.map((entry) =>
        entry.copy_id
          ? { book_id: entry.book.id, copy_id: entry.copy_id, qty: 1 }
          : { book_id: entry.book.id, qty: entry.quantity }
      );

      const payload: Record<string, unknown> = {
        card_type_category: tab,
        user_id: tab === "member" ? selectedMember?.id ?? null : null,
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        phone_number: phone.trim(),
        address: address.trim(),
        card_type: cardType,
        valid_until: validUntil.trim() || null,
        book_ids: bookIdsPayload,
      };
      if (photoPath) {
        payload.photo_path = photoPath;
      }
      if (isAdmin && adminBackdate) {
        payload.date_issued = backdateIssued;
        payload.backdate_reason = backdateReason.trim();
      }

      const res = (await apiMutate("/api/admin/data", {
        method: "POST",
        body: {
          resource: "library_cards",
          action: "create",
          payload,
        },
      })) as { ok?: boolean; id?: number; date_return?: string };

      await Promise.all([mutateCards(), mutateBooks()]);
      setConfirmOpen(false);
      setReceipt({
        cardId: res.id ?? 0,
        category: tab,
        fullname: `${firstname.trim()} ${lastname.trim()}`,
        dateIssued: effectiveIssueISO,
        dateReturn: res.date_return || expectedDueISO,
        cardType: cardType === "city_govt" ? "Iloilo City Government (LGU)" : "Regular / Student / Others",
        validUntil: validUntil.trim() || "—",
        books: selectedBooks.map((entry) => ({
          bookId: entry.book.id,
          title: entry.book.title,
          author: entry.book.author,
          isbn: entry.book.isbn || "",
          accessionNumber: entry.accession_number,
          quantity: entry.quantity,
        })),
      });
      showToast(
        tab === "member"
          ? "Member library card registered successfully!"
          : "Borrower library card registered successfully!",
        "success"
      );
    } catch (err) {
      setConfirmOpen(false);
      const rawMsg = err instanceof Error ? err.message : "Failed to register library card.";
      const friendly = formatBorrowErrorMessage(rawMsg);
      setFormError(friendly);
      showToast(friendly, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StaffShell title="Borrowing Form" role={role}>
      <div className="admin-circulation-page">
        {/* Header */}
        <header className="circ-phdr no-print">
          <div className="circ-phdr-left">
            <div className="circ-phdr-icon">
              <CreditCard className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1>Library Card Registration</h1>
              <p>Dr. Graciano Lopez Jaena Learning Resource Center · Admin &amp; Librarian access</p>
            </div>
          </div>
        </header>

        {/* Printable Receipt Success State */}
        {receipt && (
          <div
            className="circ-sc g circ-print-receipt"
            role="status"
            aria-live="polite"
            style={{ borderColor: "rgba(72, 199, 142, 0.45)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle2 className="h-5 w-5" style={{ color: "var(--circ-accent2)" }} aria-hidden="true" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.96rem" }}>
                    {receipt.category === "member" ? "Member" : "Borrower"} Registered — Card #{receipt.cardId}
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "var(--circ-tl)" }}>
                    Iloilo City Public Library · Borrowing Slip
                  </div>
                </div>
              </div>
              <div className="no-print" style={{ display: "flex", gap: 8 }}>
                <button type="button" className="circ-btn" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" aria-hidden="true" /> Print Receipt
                </button>
                <button type="button" className="circ-btn green" onClick={handleReset}>
                  New Registration
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, fontSize: "0.82rem", marginBottom: 12 }}>
              <div><strong>Cardholder:</strong> {receipt.fullname}</div>
              <div><strong>Date Issued:</strong> {receipt.dateIssued}</div>
              <div><strong>Due Date (Server):</strong> {receipt.dateReturn}</div>
              <div><strong>Card Type:</strong> {receipt.cardType}</div>
              <div><strong>Valid Until:</strong> {receipt.validUntil}</div>
              <div>
                <strong>Total Books:</strong>{" "}
                {receipt.books.reduce((s, b) => s + b.quantity, 0)}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--circ-border)", paddingTop: 10 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--circ-muted)", marginBottom: 6 }}>
                Borrowed Items
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: 4 }}>
                {receipt.books.map((item, idx) => (
                  <li key={`${item.bookId}-${item.accessionNumber ?? idx}`}>
                    <strong>#{item.bookId} · {item.title}</strong> ({item.author}) — ×{item.quantity}
                    {item.accessionNumber ? ` · Copy ${item.accessionNumber}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="circ-tabs no-print" role="tablist" aria-label="Registration type">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "member"}
            className={`circ-tab-btn ${tab === "member" ? "active" : ""}`}
            onClick={() => handleSwitchTab("member")}
          >
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            Member Form
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "borrower"}
            className={`circ-tab-btn green ${tab === "borrower" ? "active" : ""}`}
            onClick={() => handleSwitchTab("borrower")}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Borrower Form
          </button>
        </div>

        {/* Mode Info Strip */}
        <div className="circ-sc no-print" style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span
                className="circ-badge"
                style={
                  tab === "member"
                    ? { background: "rgba(159, 193, 225, 0.14)", color: "var(--circ-accent)", border: "1px solid rgba(159, 193, 225, 0.28)" }
                    : { background: "rgba(72, 199, 142, 0.14)", color: "var(--circ-accent2)", border: "1px solid rgba(72, 199, 142, 0.28)" }
                }
              >
                {tab === "member" ? "Library Member" : "Walk-In Borrower"}
              </span>
              <span style={{ fontSize: "0.78rem", color: "var(--circ-tl)" }}>
                {tab === "member"
                  ? `Search a registered user to auto-fill · up to ${CIRCULATION_POLICY.MAX_ACTIVE_BORROWS} active books allowed.`
                  : `Walk-in patron — up to ${CIRCULATION_POLICY.MAX_ACTIVE_BORROWS} books per card.`}
              </span>
            </div>
            <span style={{ fontSize: "0.76rem", color: "var(--circ-tl)", fontFamily: "var(--font-mono), monospace" }}>
              {todayLong}
            </span>
          </div>
        </div>

        {formError && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              marginBottom: 14,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255, 99, 99, 0.35)",
              background: "rgba(255, 99, 99, 0.12)",
              color: "var(--circ-danger)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "0.84rem",
              fontWeight: 600,
            }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleOpenConfirm} className="no-print">
          <div className="circ-form-cols">
            {/* LEFT COLUMN */}
            <div>
              {tab === "member" && (
                <div className="circ-sc">
                  <div className="circ-sh">
                    <div className="circ-shi si-b">
                      <Search className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h2>Find Member</h2>
                      <p>Search by name to auto-fill (shows name &amp; account status only)</p>
                    </div>
                  </div>

                  <div className="circ-combo" ref={memberComboRef}>
                    <div className="circ-search-bar">
                      <Search className="h-4 w-4 shrink-0" style={{ color: "var(--circ-accent)" }} aria-hidden="true" />
                      <input
                        type="text"
                        role="combobox"
                        aria-expanded={memberDropOpen}
                        aria-autocomplete="list"
                        aria-label="Search registered members by name"
                        value={memberQuery}
                        onChange={(e) => {
                          setMemberQuery(e.target.value);
                          setMemberDropOpen(true);
                          setMemberHighlight(0);
                        }}
                        onFocus={() => {
                          if (memberQuery.trim()) setMemberDropOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (!memberDropOpen) return;
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setMemberHighlight((i) => Math.min(memberResults.length - 1, i + 1));
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setMemberHighlight((i) => Math.max(0, i - 1));
                          } else if (e.key === "Enter" && memberResults[memberHighlight]) {
                            e.preventDefault();
                            handleSelectMember(memberResults[memberHighlight]);
                          } else if (e.key === "Escape") {
                            setMemberDropOpen(false);
                          }
                        }}
                        placeholder="Type first or last name…"
                      />
                      {selectedMember && (
                        <button
                          type="button"
                          onClick={handleClearMember}
                          aria-label="Clear selected member"
                          style={{ background: "none", border: "none", color: "var(--circ-muted)", cursor: "pointer" }}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {memberDropOpen && debouncedMemberQ.length > 0 && (
                      <div className="circ-drop" role="listbox" aria-label="Member search results">
                        {memberLoading ? (
                          <div style={{ padding: 14, textAlign: "center", fontSize: "0.82rem", color: "var(--circ-accent)" }}>
                            Searching members…
                          </div>
                        ) : memberResults.length === 0 ? (
                          <div style={{ padding: 16, textAlign: "center", fontSize: "0.82rem", color: "var(--circ-muted)" }}>
                            No members found matching that name
                          </div>
                        ) : (
                          memberResults.map((m, idx) => (
                            <button
                              key={m.id}
                              type="button"
                              role="option"
                              aria-selected={idx === memberHighlight}
                              className={`circ-drop-item ${idx === memberHighlight ? "highlighted" : ""}`}
                              onClick={() => handleSelectMember(m)}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: "0.86rem" }}>{m.fullname}</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--circ-tl)" }}>
                                  {m.library_card_number
                                    ? `Card ${m.library_card_number}`
                                    : `Member ID #${m.id}`}{" "}
                                  · {m.is_active === false ? "Inactive" : "Active"}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {selectedMember && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 13px",
                        borderRadius: 10,
                        background: memberBlockedReason
                          ? "rgba(255, 99, 99, 0.12)"
                          : "rgba(72, 199, 142, 0.1)",
                        border: `1px solid ${memberBlockedReason ? "rgba(255, 99, 99, 0.3)" : "rgba(72, 199, 142, 0.25)"}`,
                        fontSize: "0.8rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div>
                        <strong>{selectedMember.fullname}</strong> · Active borrowed books:{" "}
                        <strong>
                          {memberBorrowedCount} / {CIRCULATION_POLICY.MAX_ACTIVE_BORROWS}
                        </strong>
                        {memberUnpaidFine > 0 ? ` · Unpaid fines: ${formatPhp(memberUnpaidFine)}` : ""}
                      </div>
                      {memberBlockedReason && (
                        <div style={{ color: "var(--circ-danger)", fontWeight: 600 }}>
                          {memberBlockedReason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="circ-sc g">
                <div className="circ-sh">
                  <div className="circ-shi si-g">
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2>Personal Info</h2>
                    <p>{tab === "member" ? "Auto-filled from selected member" : "Enter borrower details manually"}</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="circ-fg">
                    <label htmlFor="cf-fn">First Name *</label>
                    <input
                      id="cf-fn"
                      type="text"
                      value={firstname}
                      readOnly={tab === "member"}
                      onChange={(e) => setFirstname(e.target.value)}
                      placeholder="First name"
                      required
                    />
                  </div>
                  <div className="circ-fg">
                    <label htmlFor="cf-ln">Last Name *</label>
                    <input
                      id="cf-ln"
                      type="text"
                      value={lastname}
                      readOnly={tab === "member"}
                      onChange={(e) => setLastname(e.target.value)}
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>

                {!(isLibrarian && tab === "member") && (
                  <>
                    <div className="circ-fg">
                      <label htmlFor="cf-phone">Phone Number</label>
                      <input
                        id="cf-phone"
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 0912-345-6789"
                      />
                    </div>

                    <div className="circ-fg" style={{ marginBottom: 0 }}>
                      <label htmlFor="cf-addr">Address</label>
                      <input
                        id="cf-addr"
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Home or office address"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* 1x1 Card Photo Upload */}
              <div className="circ-sc">
                <div className="circ-sh">
                  <div className="circ-shi si-b">
                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2>1×1 Card Photo</h2>
                    <p>Optional portrait photo (JPEG, PNG, or WebP · max 2 MB)</p>
                  </div>
                </div>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  aria-label="Upload 1x1 library card photo"
                  style={{ display: "none" }}
                />

                {photoPreviewUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <img
                      src={photoPreviewUrl}
                      alt="1x1 Library card preview"
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: "cover",
                        borderRadius: 10,
                        border: "1px solid var(--circ-border)",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--circ-accent2)" }}>
                        Photo attached
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          className="circ-btn"
                          style={{ minHeight: 34, fontSize: "0.76rem" }}
                          disabled={photoUploading || submitting}
                          onClick={() => photoInputRef.current?.click()}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          className="circ-btn danger"
                          style={{ minHeight: 34, fontSize: "0.76rem" }}
                          disabled={photoUploading || submitting}
                          onClick={handleClearPhoto}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={photoUploading || submitting}
                    onClick={() => photoInputRef.current?.click()}
                    className="circ-disabled-box"
                    style={{
                      width: "100%",
                      cursor: photoUploading ? "wait" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {photoUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Upload className="h-5 w-5 opacity-75" aria-hidden="true" />
                    )}
                    <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                      {photoUploading ? "Uploading photo…" : "Click to upload 1×1 ID photo"}
                    </span>
                    <span style={{ fontSize: "0.72rem", opacity: 0.75 }}>
                      JPEG, PNG, or WebP · Max 2 MB
                    </span>
                  </button>
                )}

                {photoError && (
                  <div role="alert" style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--circ-danger)", fontWeight: 600 }}>
                    {photoError}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div>
              {/* Multi-Book Picker */}
              <div className="circ-sc g">
                <div className="circ-sh">
                  <div className="circ-shi si-g">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2>Books Borrowed</h2>
                    <p>Search by Book ID (#), title, author, ISBN, or scan accession/barcode (⌘K)</p>
                  </div>
                </div>

                <div className="circ-combo" ref={bookComboRef}>
                  <div className="circ-search-bar green">
                    <Search className="h-4 w-4 shrink-0" style={{ color: "var(--circ-accent2)" }} aria-hidden="true" />
                    <input
                      ref={bookInputRef}
                      type="text"
                      role="combobox"
                      aria-expanded={bookDropOpen}
                      aria-autocomplete="list"
                      aria-label="Search books by ID, title, author, ISBN, or accession number"
                      value={bookQuery}
                      onChange={(e) => {
                        setBookQuery(e.target.value);
                        setBookDropOpen(true);
                        setBookHighlight(0);
                      }}
                      onFocus={() => {
                        if (bookQuery.trim()) setBookDropOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const rawQ = bookQuery.trim().toLowerCase();
                          // Exact accession match selects the specific copy_id
                          for (const b of allBooks) {
                            const matchedCopy = (b.copies ?? []).find(
                              (cp) =>
                                (cp.accession_number || "").toLowerCase() === rawQ &&
                                isBorrowableCopy(cp)
                            );
                            if (matchedCopy) {
                              handleAddBook(b, matchedCopy);
                              return;
                            }
                          }
                          // Exact ISBN, catalog_code, or Book ID match
                          const cleanIdQ = rawQ.replace(/^#/, "");
                          const exactBook = allBooks.find(
                            (b) =>
                              getAvailableCopyCount(b) > 0 &&
                              ((b.isbn || "").toLowerCase() === rawQ ||
                                (b.catalog_code || "").toLowerCase() === rawQ ||
                                (/^\d+$/.test(cleanIdQ) && String(b.id) === cleanIdQ))
                          );
                          if (exactBook) {
                            handleAddBook(exactBook);
                            return;
                          }
                          const picked = filteredBooks[bookHighlight];
                          if (picked && getAvailableCopyCount(picked) > 0) {
                            handleAddBook(picked);
                          }
                        } else if (e.key === "ArrowDown" && bookDropOpen) {
                          e.preventDefault();
                          setBookHighlight((i) => Math.min(filteredBooks.length - 1, i + 1));
                        } else if (e.key === "ArrowUp" && bookDropOpen) {
                          e.preventDefault();
                          setBookHighlight((i) => Math.max(0, i - 1));
                        } else if (e.key === "Escape") {
                          setBookDropOpen(false);
                        }
                      }}
                      placeholder="Search Book ID (#), title, author, ISBN, or accession… (⌘K)"
                    />
                    <span
                      className="circ-badge"
                      style={{
                        background: limitExceeded
                          ? "rgba(255, 99, 99, 0.14)"
                          : "rgba(72, 199, 142, 0.14)",
                        color: limitExceeded ? "var(--circ-danger)" : "var(--circ-accent2)",
                        border: `1px solid ${limitExceeded ? "rgba(255, 99, 99, 0.3)" : "rgba(72, 199, 142, 0.28)"}`,
                      }}
                    >
                      {selectedTotalQty} / {maxAddable} books
                    </span>
                  </div>

                  {bookDropOpen && debouncedBookQ.length > 0 && (
                    <div className="circ-drop" role="listbox" aria-label="Book search results">
                      {booksLoading && filteredBooks.length === 0 ? (
                        <div style={{ padding: 14, textAlign: "center", fontSize: "0.82rem", color: "var(--circ-accent)" }}>
                          Searching books…
                        </div>
                      ) : filteredBooks.length === 0 ? (
                        <div style={{ padding: 16, textAlign: "center", fontSize: "0.82rem", color: "var(--circ-muted)" }}>
                          No books match your search
                        </div>
                      ) : (
                        filteredBooks.map((b, idx) => {
                          const avail = getAvailableCopyCount(b);
                          const alreadyChosen = getSelectedQtyForBook(b.id);
                          const remaining = Math.max(0, avail - alreadyChosen);
                          const outOfStock = remaining <= 0;
                          const availableCopies = (b.copies ?? []).filter(
                            (cp) =>
                              isBorrowableCopy(cp) &&
                              !selectedBooks.some((e) => e.copy_id === Number(cp.id))
                          );
                          return (
                            <div
                              key={b.id}
                              role="option"
                              aria-selected={idx === bookHighlight}
                              className={`circ-drop-item ${idx === bookHighlight ? "highlighted" : ""}`}
                              style={{ flexDirection: "column", alignItems: "stretch", gap: 6, cursor: outOfStock ? "not-allowed" : "pointer" }}
                              onClick={() => {
                                if (!outOfStock) handleAddBook(b);
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{b.title}</div>
                                  <div style={{ fontSize: "0.72rem", color: "var(--circ-tl)" }}>
                                    Book ID #{b.id} · {b.author}
                                    {b.isbn ? ` · ISBN: ${b.isbn}` : ""}
                                  </div>
                                </div>
                                <span
                                  className="circ-badge"
                                  style={
                                    outOfStock
                                      ? { background: "rgba(255, 99, 99, 0.14)", color: "var(--circ-danger)" }
                                      : { background: "rgba(72, 199, 142, 0.14)", color: "var(--circ-accent2)" }
                                  }
                                >
                                  {outOfStock ? "Unavailable" : `${remaining} available`}
                                </span>
                              </div>
                              {availableCopies.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {availableCopies.slice(0, 4).map((cp, ci) => (
                                    <button
                                      key={cp.id ?? ci}
                                      type="button"
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        handleAddBook(b, cp);
                                      }}
                                      style={{
                                        fontSize: "0.7rem",
                                        padding: "2px 8px",
                                        borderRadius: 6,
                                        border: "1px solid rgba(72, 199, 142, 0.35)",
                                        background: "rgba(72, 199, 142, 0.1)",
                                        color: "var(--circ-accent2)",
                                        cursor: "pointer",
                                      }}
                                    >
                                      + {cp.accession_number || `Copy #${cp.copy_number ?? ci + 1}`}
                                      {cp.condition && cp.condition !== "Good" ? ` (${cp.condition})` : ""}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {selectedBooks.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                    {selectedBooks.map((entry) => {
                      const avail = getAvailableCopyCount(entry.book);
                      const totalForBook = getSelectedQtyForBook(entry.book.id);
                      const exceeds = totalForBook > avail;
                      return (
                        <div key={entry.key} className={`circ-book-chip ${exceeds ? "warn" : ""}`}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.86rem" }}>
                              {entry.book.title}
                              {entry.accession_number ? (
                                <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--circ-accent)" }}>
                                  [{entry.accession_number}]
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "var(--circ-tl)" }}>
                              Book ID #{entry.book.id} · by {entry.book.author}
                              {entry.book.isbn ? ` · ISBN: ${entry.book.isbn}` : ""}
                            </div>
                            <div style={{ fontSize: "0.72rem", marginTop: 3, color: exceeds ? "var(--circ-danger)" : "var(--circ-accent2)", fontWeight: 600 }}>
                              {exceeds
                                ? `Exceeds stock (${avail} Good/Fair available)`
                                : entry.copy_id
                                  ? `Specific Copy #${entry.copy_id} locked`
                                  : `${avail} Good/Fair available`}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <label htmlFor={`cf-qty-${entry.key}`} style={{ fontSize: "0.7rem", fontWeight: 700 }}>
                              Qty
                            </label>
                            <input
                              id={`cf-qty-${entry.key}`}
                              type="number"
                              min={1}
                              max={entry.copy_id ? 1 : Math.max(1, avail)}
                              readOnly={entry.copy_id !== null}
                              value={entry.quantity}
                              onChange={(e) => handleUpdateEntryQty(entry.key, Number(e.target.value))}
                              style={{
                                width: 56,
                                minHeight: 38,
                                textAlign: "center",
                                borderRadius: 8,
                                border: "1px solid var(--circ-border)",
                                background: "var(--circ-input-bg)",
                                color: "var(--circ-text)",
                                fontWeight: 700,
                              }}
                            />
                            <button
                              type="button"
                              className="circ-icon-btn del"
                              aria-label={`Remove ${entry.book.title}`}
                              onClick={() => handleRemoveEntry(entry.key)}
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "14px 16px",
                      borderRadius: 12,
                      border: "2px dashed rgba(72, 199, 142, 0.2)",
                      fontSize: "0.8rem",
                      color: "var(--circ-muted)",
                    }}
                  >
                    No books selected yet — search above to add up to {maxAddable} book
                    {maxAddable === 1 ? "" : "s"}
                  </div>
                )}
              </div>

              {/* Card & Server-Owned Dates */}
              <div className="circ-sc o">
                <div className="circ-sh">
                  <div className="circ-shi si-o">
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2>Card &amp; Dates</h2>
                    <p>Server-owned issue &amp; due dates (Asia/Manila)</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="circ-fg">
                    <label htmlFor="cf-issued">Date Issued (Server)</label>
                    <input id="cf-issued" type="date" value={effectiveIssueISO} readOnly />
                  </div>
                  <div className="circ-fg">
                    <label htmlFor="cf-due-ro">Due Date ({CIRCULATION_POLICY.DEFAULT_LOAN_DAYS} days)</label>
                    <input id="cf-due-ro" type="date" value={expectedDueISO} readOnly />
                  </div>
                </div>
                <p style={{ margin: "-4px 0 12px", fontSize: "0.74rem", color: "var(--circ-muted)" }}>
                  Due date is assigned automatically by the server ({CIRCULATION_POLICY.DEFAULT_LOAN_DAYS}-day loan, {CIRCULATION_POLICY.MAX_LOAN_DAYS}-day max).
                </p>

                {isAdmin && (
                  <div
                    style={{
                      marginBottom: 14,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--circ-border)",
                      background: "rgba(255, 152, 0, 0.06)",
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={adminBackdate}
                        onChange={(e) => setAdminBackdate(e.target.checked)}
                      />
                      Admin Backdate Issue Date (requires audit reason)
                    </label>
                    {adminBackdate && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 10 }}>
                        <div className="circ-fg" style={{ marginBottom: 0 }}>
                          <label htmlFor="cf-bd-date">Backdated Issue Date *</label>
                          <input
                            id="cf-bd-date"
                            type="date"
                            max={todayISO}
                            value={backdateIssued}
                            onChange={(e) => setBackdateIssued(e.target.value)}
                            required
                          />
                        </div>
                        <div className="circ-fg" style={{ marginBottom: 0 }}>
                          <label htmlFor="cf-bd-reason">Backdate Reason * (min 3 chars)</label>
                          <input
                            id="cf-bd-reason"
                            type="text"
                            value={backdateReason}
                            onChange={(e) => setBackdateReason(e.target.value)}
                            placeholder="Reason for backdating…"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="circ-fg">
                  <label htmlFor="cf-ctype">Card Type *</label>
                  <select
                    id="cf-ctype"
                    value={cardType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCardType(val);
                      setValidUntil(computeAutoValidUntil(val));
                    }}
                    required
                  >
                    <option value="">— Select —</option>
                    <option value="city_govt">Iloilo City Government (LGU)</option>
                    <option value="regular">Regular / Student / Others</option>
                  </select>
                </div>

                <div
                  style={{
                    background: "rgba(159, 193, 225, 0.06)",
                    border: "1px solid var(--circ-border)",
                    borderRadius: 13,
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem", fontWeight: 700, color: "var(--circ-accent)", marginBottom: 8 }}>
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Validity Period
                  </div>
                  <div className="circ-fg" style={{ marginBottom: 8 }}>
                    <label htmlFor="cf-valid">Valid Until</label>
                    <input
                      id="cf-valid"
                      type="text"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      placeholder="(auto-fills on card type)"
                    />
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--circ-muted)", lineHeight: 1.6 }}>
                    <strong>LGU Card:</strong> Valid until retirement or separation from service.
                    <br />
                    <strong>Other users:</strong> Valid for One (1) Year from issuance.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" className="circ-btn" onClick={handleReset} disabled={submitting}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Clear
            </button>
            <button
              type="submit"
              className={`circ-btn ${tab === "member" ? "primary" : "green"}`}
              disabled={!canBorrow || submitting || photoUploading || Boolean(stockProblemEntry) || limitExceeded || Boolean(memberBlockedReason)}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {tab === "member" ? "Register Member" : "Register Borrower"}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && selectedBooks.length > 0 && (
        <div
          className="circ-modal-backdrop no-print"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setConfirmOpen(false);
          }}
        >
          <div
            ref={confirmModalRef}
            className="circ-modal-box sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bf-confirm-title"
            tabIndex={-1}
          >
            <div className="circ-modal-hdr">
              <h2 id="bf-confirm-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                Confirm {tab === "member" ? "Member" : "Borrower"} Registration
              </h2>
              <button
                type="button"
                className="circ-icon-btn"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                aria-label="Close confirmation"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="circ-modal-body" style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.86rem" }}>
              <div><strong>Cardholder:</strong> {firstname} {lastname}</div>
              <div>
                <strong>Books ({selectedTotalQty}):</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {selectedBooks.map((entry) => (
                    <li key={entry.key}>
                      {entry.book.title} (Qty: {entry.quantity}
                      {entry.accession_number ? ` · ${entry.accession_number}` : ""})
                    </li>
                  ))}
                </ul>
              </div>
              <div><strong>Date Issued:</strong> {effectiveIssueISO}</div>
              <div><strong>Expected Due Date:</strong> {expectedDueISO} (confirmed by server)</div>
              <div><strong>Valid Until:</strong> {validUntil || "—"}</div>
            </div>
            <div className="circ-modal-foot">
              <button type="button" className="circ-btn" onClick={() => setConfirmOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                className="circ-btn green"
                onClick={handleConfirmSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Submitting…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Confirm &amp; Issue
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="circ-toast no-print" role="status" aria-live="polite">
          <span>{toast.message}</span>
        </div>
      )}
    </StaffShell>
  );
}
