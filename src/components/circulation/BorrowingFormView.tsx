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
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { apiMutate, swrPrivateConfig } from "@/lib/api";
import {
  type CatalogBook,
  type CirculationToast,
  type LibraryCardRow,
  type PickerMember,
  computeAutoValidUntil,
  getManilaLongDate,
  getManilaTodayISO,
} from "./types";
import "./circulation.css";

interface ReceiptData {
  cardId: number;
  category: "member" | "borrower";
  fullname: string;
  dateIssued: string;
  dateReturn: string;
  cardType: string;
  validUntil: string;
  bookTitle: string;
  bookAuthor: string;
  quantity: number;
}

export interface BorrowingFormViewProps {
  role?: "admin" | "librarian";
  canBorrow?: boolean;
}

function getAvailableCopyCount(b: CatalogBook): number {
  if (Array.isArray(b.copies) && b.copies.length > 0) {
    const fromCopies = b.copies.filter(
      (cp) => String(cp.circulation_status ?? "Available") === "Available"
    ).length;
    return Math.min(Number(b.available_copies ?? fromCopies), fromCopies || Number(b.available_copies ?? 0));
  }
  return Number(b.available_copies ?? 0);
}

export function BorrowingFormView({
  role = "admin",
  canBorrow = true,
}: BorrowingFormViewProps = {}) {
  const todayISO = useMemo(() => getManilaTodayISO(), []);
  const todayLong = useMemo(() => getManilaLongDate(), []);
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

  // Book search combobox (supports barcode scanner Enter on ISBN)
  const [bookQuery, setBookQuery] = useState("");
  const [debouncedBookQ, setDebouncedBookQ] = useState("");
  const [bookDropOpen, setBookDropOpen] = useState(false);
  const [bookHighlight, setBookHighlight] = useState(0);
  const [selectedBook, setSelectedBook] = useState<CatalogBook | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Card & dates
  const [dateReturn, setDateReturn] = useState("");
  const [cardType, setCardType] = useState("");
  const [validUntil, setValidUntil] = useState("");

  // Confirm modal, submission, receipt, toast
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [toast, setToast] = useState<CirculationToast | null>(null);

  const memberComboRef = useRef<HTMLDivElement>(null);
  const bookComboRef = useRef<HTMLDivElement>(null);
  const confirmModalRef = useRef<HTMLDivElement>(null);

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

  // Debounce member & book searches (300ms)
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedMemberQ(memberQuery.trim()), 300);
    return () => window.clearTimeout(t);
  }, [memberQuery]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedBookQ(bookQuery.trim().toLowerCase()), 300);
    return () => window.clearTimeout(t);
  }, [bookQuery]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
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

  // Live member picker (minimal fields only — no contact/ID photos in dropdown)
  const { data: memberData, isLoading: memberLoading } = useSWR<{ users?: PickerMember[] }>(
    tab === "member" && debouncedMemberQ.length > 0
      ? `/api/admin/users?role=member&mode=picker&limit=20&q=${encodeURIComponent(debouncedMemberQ)}`
      : null,
    swrPrivateConfig
  );

  // Catalog books & existing cards (to show member's current borrowed count)
  const { data: booksData, isLoading: booksLoading } = useSWR<{ rows?: CatalogBook[] }>(
    "/api/admin/data?resource=books",
    swrPrivateConfig
  );

  const { data: cardsData, mutate: mutateCards } = useSWR<{ rows?: LibraryCardRow[] }>(
    "/api/admin/data?resource=library_cards",
    swrPrivateConfig
  );

  const memberResults = useMemo(() => memberData?.users ?? [], [memberData?.users]);
  const allBooks = useMemo(() => booksData?.rows ?? [], [booksData?.rows]);

  const filteredBooks = useMemo(() => {
    if (!debouncedBookQ) return [];
    const cleanIdQ = debouncedBookQ.replace(/^#/, "");
    return allBooks
      .filter(
        (b) =>
          String(b.id) === cleanIdQ ||
          (b.title || "").toLowerCase().includes(debouncedBookQ) ||
          (b.author || "").toLowerCase().includes(debouncedBookQ) ||
          (b.isbn || "").toLowerCase().includes(debouncedBookQ) ||
          (b.catalog_code || "").toLowerCase().includes(debouncedBookQ) ||
          (b.copies ?? []).some((cp) =>
            (cp.accession_number || "").toLowerCase().includes(debouncedBookQ)
          )
      )
      .slice(0, 20);
  }, [allBooks, debouncedBookQ]);

  const memberBorrowedCount = useMemo(() => {
    if (!selectedMember) return 0;
    return (cardsData?.rows ?? [])
      .filter((c) => c.user_id === selectedMember.id)
      .reduce((sum, c) => sum + Number(c.books_count ?? 0), 0);
  }, [cardsData?.rows, selectedMember]);

  const memberBlockedReason = useMemo(() => {
    if (!selectedMember) return null;
    if (selectedMember.is_active === false) return "Member account is inactive.";
    if (selectedMember.is_approved === false) return "Member account is pending approval.";
    return null;
  }, [selectedMember]);

  const qtyExceedsStock =
    selectedBook !== null &&
    typeof selectedBook.available_copies === "number" &&
    quantity > selectedBook.available_copies;

  const isDueDateInPast = Boolean(dateReturn && dateReturn < todayISO);

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

  const handleSelectBook = (b: CatalogBook) => {
    if ((b.available_copies ?? 0) <= 0) return;
    setSelectedBook(b);
    setQuantity(1);
    setBookQuery("");
    setBookDropOpen(false);
    setFormError(null);
  };

  const handleReset = () => {
    handleClearMember();
    setSelectedBook(null);
    setQuantity(1);
    setBookQuery("");
    setDateReturn("");
    setCardType("");
    setValidUntil("");
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
    if (tab === "borrower" && !dateReturn) {
      setFormError("Date of Return is required for walk-in borrowers.");
      return;
    }
    if (isDueDateInPast) {
      setFormError("Date of Return cannot be in the past.");
      return;
    }
    if (!selectedBook) {
      setFormError("Please select an available book to borrow.");
      return;
    }
    if (qtyExceedsStock) {
      setFormError(
        `Cannot register — quantity (${quantity}) exceeds available stock (${selectedBook.available_copies}).`
      );
      return;
    }
    if (memberBlockedReason) {
      setFormError(memberBlockedReason);
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!selectedBook) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = (await apiMutate("/api/admin/data", {
        method: "POST",
        body: {
          resource: "library_cards",
          action: "create",
          payload: {
            card_type_category: tab,
            user_id: tab === "member" ? selectedMember?.id ?? null : null,
            firstname: firstname.trim(),
            lastname: lastname.trim(),
            phone_number: phone.trim(),
            address: address.trim(),
            date_issued: todayISO,
            date_return: dateReturn || null,
            card_type: cardType,
            valid_until: validUntil.trim() || null,
            book_id: selectedBook.id,
            quantity,
          },
        },
      })) as { ok?: boolean; id?: number };

      await mutateCards();
      setConfirmOpen(false);
      setReceipt({
        cardId: res.id ?? 0,
        category: tab,
        fullname: `${firstname.trim()} ${lastname.trim()}`,
        dateIssued: todayISO,
        dateReturn: dateReturn || "—",
        cardType: cardType === "city_govt" ? "Iloilo City Government (LGU)" : "Regular / Student / Others",
        validUntil: validUntil.trim() || "—",
        bookTitle: selectedBook.title,
        bookAuthor: selectedBook.author,
        quantity,
      });
      showToast(
        tab === "member"
          ? "Member library card registered successfully!"
          : "Borrower library card registered successfully!",
        "success"
      );
    } catch (err) {
      setConfirmOpen(false);
      const msg = err instanceof Error ? err.message : "Failed to register library card.";
      setFormError(msg);
      showToast(msg, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StaffShell title="Borrowing Form" role={role}>
      <div className="admin-circulation-page">
        {/* Header */}
        <header className="circ-phdr">
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, fontSize: "0.82rem" }}>
              <div><strong>Cardholder:</strong> {receipt.fullname}</div>
              <div><strong>Date Issued:</strong> {receipt.dateIssued}</div>
              <div><strong>Date of Return:</strong> {receipt.dateReturn}</div>
              <div><strong>Card Type:</strong> {receipt.cardType}</div>
              <div><strong>Valid Until:</strong> {receipt.validUntil}</div>
              <div><strong>Book:</strong> {receipt.bookTitle} (×{receipt.quantity})</div>
            </div>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="circ-tabs" role="tablist" aria-label="Registration type">
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
        <div className="circ-sc" style={{ padding: "14px 20px" }}>
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
                  ? "Search a registered user to auto-fill their details."
                  : "Manual entry — fill in all details by hand."}
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

        <form onSubmit={handleOpenConfirm}>
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
                        padding: "9px 13px",
                        borderRadius: 10,
                        background: memberBlockedReason
                          ? "rgba(255, 99, 99, 0.12)"
                          : "rgba(72, 199, 142, 0.1)",
                        border: `1px solid ${memberBlockedReason ? "rgba(255, 99, 99, 0.3)" : "rgba(72, 199, 142, 0.25)"}`,
                        fontSize: "0.8rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span>
                        <strong>{selectedMember.fullname}</strong> · Current borrowed books:{" "}
                        <strong>{memberBorrowedCount}</strong>
                        {memberBlockedReason ? ` — ${memberBlockedReason}` : ""}
                      </span>
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

              {/* Legacy 1x1 Photo Box — disabled, no backend column in create */}
              <div className="circ-sc">
                <div className="circ-sh">
                  <div className="circ-shi si-b">
                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2>1×1 Photo</h2>
                    <p>Not available yet</p>
                  </div>
                </div>
                <div className="circ-disabled-box" aria-disabled="true">
                  <ImageIcon className="mx-auto mb-1.5 h-6 w-6 opacity-50" aria-hidden="true" />
                  <div style={{ fontWeight: 700 }}>Not available yet</div>
                  <div style={{ fontSize: "0.72rem", marginTop: 3 }}>
                    1×1 card photo upload requires `photo_path` support in `library_cards` create API.
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div>
              {/* Book Picker */}
              <div className="circ-sc g">
                <div className="circ-sh">
                  <div className="circ-shi si-g">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2>Books Borrowed</h2>
                    <p>Search by title, author, or scan ISBN barcode and press Enter</p>
                  </div>
                </div>

                <div className="circ-combo" ref={bookComboRef}>
                  <div className="circ-search-bar green">
                    <Search className="h-4 w-4 shrink-0" style={{ color: "var(--circ-accent2)" }} aria-hidden="true" />
                    <input
                      type="text"
                      role="combobox"
                      aria-expanded={bookDropOpen}
                      aria-autocomplete="list"
                      aria-label="Search books by title, author, or ISBN barcode"
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
                          const exactScan = allBooks.find(
                            (b) =>
                              getAvailableCopyCount(b) > 0 &&
                              ((b.isbn || "").toLowerCase() === rawQ ||
                                (b.catalog_code || "").toLowerCase() === rawQ ||
                                (b.copies ?? []).some(
                                  (cp) =>
                                    (cp.accession_number || "").toLowerCase() === rawQ &&
                                    String(cp.circulation_status ?? "Available") === "Available"
                                ))
                          );
                          if (exactScan) {
                            handleSelectBook(exactScan);
                            return;
                          }
                          const picked = filteredBooks[bookHighlight];
                          if (picked && getAvailableCopyCount(picked) > 0) {
                            handleSelectBook(picked);
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
                      placeholder="Search title, author, or ISBN…"
                    />
                    <span
                      className="circ-badge"
                      style={{
                        background: "rgba(72, 199, 142, 0.14)",
                        color: "var(--circ-accent2)",
                        border: "1px solid rgba(72, 199, 142, 0.28)",
                      }}
                    >
                      {selectedBook ? "1 / 1 book" : "0 books"}
                    </span>
                  </div>

                  {bookDropOpen && debouncedBookQ.length > 0 && (
                    <div className="circ-drop" role="listbox" aria-label="Book search results">
                      {booksLoading ? (
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
                          const outOfStock = avail <= 0;
                          const sampleAccessions = (b.copies ?? [])
                            .filter((cp) => String(cp.circulation_status ?? "Available") === "Available" && cp.accession_number)
                            .slice(0, 2)
                            .map((cp) => cp.accession_number)
                            .join(", ");
                          return (
                            <button
                              key={b.id}
                              type="button"
                              role="option"
                              disabled={outOfStock}
                              aria-selected={idx === bookHighlight}
                              className={`circ-drop-item ${idx === bookHighlight ? "highlighted" : ""}`}
                              onClick={() => handleSelectBook(b)}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{b.title}</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--circ-tl)" }}>
                                  Book ID #{b.id} · {b.author}
                                  {b.isbn ? ` · ISBN: ${b.isbn}` : ""}
                                  {sampleAccessions ? ` · Copy: ${sampleAccessions}` : ""}
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
                                {outOfStock ? "Out of stock" : `${avail} available`}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {selectedBook ? (
                  <div className={`circ-book-chip ${qtyExceedsStock ? "warn" : ""}`}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.86rem" }}>{selectedBook.title}</div>
                      <div style={{ fontSize: "0.74rem", color: "var(--circ-tl)" }}>
                        Book ID #{selectedBook.id} · by {selectedBook.author}
                        {selectedBook.isbn ? ` · ISBN: ${selectedBook.isbn}` : ""}
                      </div>
                      <div style={{ fontSize: "0.72rem", marginTop: 3, color: qtyExceedsStock ? "var(--circ-danger)" : "var(--circ-accent2)", fontWeight: 600 }}>
                        {qtyExceedsStock
                          ? `Exceeds stock (${selectedBook.available_copies} available)`
                          : `${selectedBook.available_copies} available`}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <label htmlFor="cf-qty" style={{ fontSize: "0.7rem", fontWeight: 700 }}>
                        Qty
                      </label>
                      <input
                        id="cf-qty"
                        type="number"
                        min={1}
                        max={Math.max(1, selectedBook.available_copies)}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
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
                        aria-label={`Remove ${selectedBook.title}`}
                        onClick={() => setSelectedBook(null)}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
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
                    No books selected yet — search above to add
                  </div>
                )}
              </div>

              {/* Card & Dates */}
              <div className="circ-sc o">
                <div className="circ-sh">
                  <div className="circ-shi si-o">
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2>Card &amp; Dates</h2>
                    <p>Issuance, return, renewals, validity (Asia/Manila)</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="circ-fg">
                    <label htmlFor="cf-issued">Date Issued *</label>
                    <input id="cf-issued" type="date" value={todayISO} readOnly required />
                  </div>
                  <div className="circ-fg">
                    <label htmlFor="cf-ret">
                      Date of Return {tab === "borrower" ? "*" : ""}
                    </label>
                    <input
                      id="cf-ret"
                      type="date"
                      min={todayISO}
                      value={dateReturn}
                      onChange={(e) => setDateReturn(e.target.value)}
                      required={tab === "borrower"}
                    />
                  </div>
                </div>

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

                {/* Initial Renewals disabled on create — editable in Borrow History */}
                <div className="circ-fg">
                  <label>Renewed (Not available yet on initial issue — edit in Borrow History)</label>
                  <div className="circ-disabled-box" style={{ padding: "10px 12px", textAlign: "left" }} aria-disabled="true">
                    1st On / 2nd On renewal checkboxes are managed after issuance on the Borrow History page.
                  </div>
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
              disabled={!canBorrow || submitting || qtyExceedsStock || isDueDateInPast}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {tab === "member" ? "Register Member" : "Register Borrower"}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && selectedBook && (
        <div
          className="circ-modal-backdrop"
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
              <div><strong>Book:</strong> {selectedBook.title} (Qty: {quantity})</div>
              <div><strong>Date Issued:</strong> {todayISO}</div>
              <div><strong>Date of Return:</strong> {dateReturn || "—"}</div>
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
        <div className="circ-toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
        </div>
      )}
    </StaffShell>
  );
}
