"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  Pencil,
  Search,
  Table as TableIcon,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { apiMutate, swrPrivateConfig } from "@/lib/api";
import {
  type CirculationToast,
  type LibraryCardRow,
  type ReturnItemRow,
  formatCardTypeLabel,
  getDaysOverdue,
  getManilaTodayISO,
} from "./types";
import {
  CardDetailModal,
  DeleteCardModal,
  EditCardModal,
  ProcessReturnModal,
} from "./BorrowHistoryModals";
import "./circulation.css";

const PAGE_SIZE = 15;

export function BorrowHistoryView() {
  const todayISO = useMemo(() => getManilaTodayISO(), []);

  const [activeTab, setActiveTab] = useState<"all" | "returns">("all");
  const [typeFilter, setTypeFilter] = useState<"" | "member" | "borrower" | "overdue">("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [viewCard, setViewCard] = useState<LibraryCardRow | null>(null);
  const [returnCard, setReturnCard] = useState<LibraryCardRow | null>(null);
  const [editCard, setEditCard] = useState<LibraryCardRow | null>(null);
  const [deleteCard, setDeleteCard] = useState<LibraryCardRow | null>(null);
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<CirculationToast | null>(null);

  const {
    data: cardsData,
    error: cardsError,
    isLoading: cardsLoading,
    mutate: mutateCards,
  } = useSWR<{ rows?: LibraryCardRow[] }>(
    "/api/admin/data?resource=library_cards",
    swrPrivateConfig
  );

  const {
    data: returnsData,
    error: returnsError,
    isLoading: returnsLoading,
    mutate: mutateReturns,
  } = useSWR<{ rows?: ReturnItemRow[] }>(
    "/api/admin/data?resource=returns",
    swrPrivateConfig
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQ(searchInput.trim().toLowerCase());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((message: string, tone: CirculationToast["tone"] = "info") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const allCards = useMemo(() => cardsData?.rows ?? [], [cardsData?.rows]);
  const allReturns = useMemo(() => returnsData?.rows ?? [], [returnsData?.rows]);

  const returnedCardIds = useMemo(
    () => new Set(allReturns.map((r) => r.card_id).filter((id): id is number => id !== null)),
    [allReturns]
  );

  const stats = useMemo(() => {
    const total = allCards.length;
    const members = allCards.filter((c) => c.card_type_category === "member").length;
    const borrowers = allCards.filter((c) => c.card_type_category === "borrower").length;
    const returned = allReturns.length;
    return {
      total,
      members,
      borrowers,
      returned,
      memberPct: total ? Math.round((members / total) * 100) : 0,
      borrowerPct: total ? Math.round((borrowers / total) * 100) : 0,
      returnPct: total ? Math.min(100, Math.round((returned / total) * 100)) : 0,
    };
  }, [allCards, allReturns]);

  const filteredCards = useMemo(() => {
    return allCards.filter((c) => {
      if (typeFilter === "member" && c.card_type_category !== "member") return false;
      if (typeFilter === "borrower" && c.card_type_category !== "borrower") return false;
      if (typeFilter === "overdue") {
        const overdue = getDaysOverdue(c.date_return, todayISO) > 0 && !returnedCardIds.has(c.id);
        if (!overdue) return false;
      }
      if (dateFrom && (c.date_issued || "") < dateFrom) return false;
      if (dateTo && (c.date_issued || "") > dateTo) return false;
      if (!debouncedQ) return true;
      const hay = `${c.fullname} ${c.phone_number || ""} ${(c.books ?? [])
        .map((b) => `${b.book_title} ${b.book_isbn || ""}`)
        .join(" ")}`.toLowerCase();
      return hay.includes(debouncedQ);
    });
  }, [allCards, typeFilter, dateFrom, dateTo, debouncedQ, todayISO, returnedCardIds]);

  const filteredReturns = useMemo(() => {
    return allReturns.filter((r) => {
      if (dateFrom && (r.return_date || "") < dateFrom) return false;
      if (dateTo && (r.return_date || "") > dateTo) return false;
      if (!debouncedQ) return true;
      const hay = `${r.borrower_name} ${r.book_title} ${r.book_author || ""} ${r.book_isbn || ""}`.toLowerCase();
      return hay.includes(debouncedQ);
    });
  }, [allReturns, dateFrom, dateTo, debouncedQ]);

  const activeList = activeTab === "all" ? filteredCards : filteredReturns;
  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;

  const pagedCards = filteredCards.slice(startIdx, startIdx + PAGE_SIZE);
  const pagedReturns = filteredReturns.slice(startIdx, startIdx + PAGE_SIZE);

  const handleConfirmReturn = async (card: LibraryCardRow, returnDate: string) => {
    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "library_cards",
          action: "return_books",
          id: card.id,
          payload: { return_date: returnDate },
        },
      });
      await Promise.all([mutateCards(), mutateReturns()]);
      setReturnCard(null);
      showToast("Books returned successfully!", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Return failed.", "danger");
    } finally {
      setMutating(false);
    }
  };

  const handleSaveEdit = async (
    card: LibraryCardRow,
    payload: {
      date_return: string;
      valid_until: string;
      renewal1_checked: boolean;
      renewal1_date: string;
      renewal2_checked: boolean;
      renewal2_date: string;
    }
  ) => {
    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "library_cards",
          action: "update",
          id: card.id,
          payload,
        },
      });
      await mutateCards();
      setEditCard(null);
      showToast("Record updated!", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed.", "danger");
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmDelete = async (card: LibraryCardRow) => {
    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "DELETE",
        body: {
          resource: "library_cards",
          action: "delete",
          id: card.id,
          payload: {},
        },
      });
      await mutateCards();
      setDeleteCard(null);
      showToast("Record deleted.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed.", "danger");
    } finally {
      setMutating(false);
    }
  };

  const handleExportCSV = () => {
    if (activeTab === "returns") {
      if (!filteredReturns.length) {
        showToast("Nothing to export.", "danger");
        return;
      }
      const rows = [
        "Borrower,Type,Book Title,Qty Returned,Date Returned",
        ...filteredReturns.map(
          (r) =>
            `"${r.borrower_name.replace(/"/g, '""')}","${r.card_category}","${r.book_title.replace(/"/g, '""')}","${r.qty_returned}","${r.return_date || ""}"`
        ),
      ].join("\n");
      const a = document.createElement("a");
      a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(rows)}`;
      a.download = `return_history_${todayISO}.csv`;
      a.click();
      showToast("CSV exported!", "success");
      return;
    }

    if (!filteredCards.length) {
      showToast("Nothing to export.", "danger");
      return;
    }
    const rows = [
      "Card ID,Name,Type,Books,Date Issued,Due Date,Card Type,Valid Until",
      ...filteredCards.map(
        (c) =>
          `"${c.id}","${c.fullname.replace(/"/g, '""')}","${c.card_type_category}","${(c.books ?? [])
            .map((b) => `${b.book_title}${b.quantity > 1 ? ` x${b.quantity}` : ""}`)
            .join("; ")
            .replace(/"/g, '""')}","${c.date_issued || ""}","${c.date_return || ""}","${formatCardTypeLabel(c.card_type)}","${(c.valid_until || "").replace(/"/g, '""')}"`
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(rows)}`;
    a.download = `library_records_${todayISO}.csv`;
    a.click();
    showToast("CSV exported!", "success");
  };

  const activeError = activeTab === "all" ? cardsError : returnsError;
  const activeLoading = activeTab === "all" ? cardsLoading : returnsLoading;

  return (
    <StaffShell title="Borrow History" role="admin">
      <div className="admin-circulation-page">
        {/* Header */}
        <header className="circ-phdr">
          <div className="circ-phdr-left">
            <div className="circ-phdr-icon">
              <CreditCard className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1>Records &amp; Returns</h1>
              <p>Dr. Graciano Lopez Jaena Learning Resource Center · Admin &amp; Librarian access</p>
            </div>
          </div>

          <button type="button" className="circ-btn export" onClick={handleExportCSV}>
            <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
          </button>
        </header>

        {/* 4 Stat Cards */}
        <section className="circ-stats-grid" aria-label="Circulation summary statistics">
          <div className="circ-stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <CreditCard className="h-5 w-5" style={{ color: "var(--circ-tl)" }} aria-hidden="true" />
              <span className="circ-badge" style={{ background: "rgba(218, 232, 245, 0.12)" }}>All</span>
            </div>
            <div className="circ-stat-num">{cardsLoading ? "—" : stats.total}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--circ-muted)" }}>Total Library Cards</div>
            <div className="circ-stat-bar">
              <div style={{ height: "100%", width: "100%", background: "var(--circ-tl)" }} />
            </div>
          </div>

          <button
            type="button"
            className="circ-stat-card"
            onClick={() => {
              setActiveTab("all");
              setTypeFilter("member");
              setPage(1);
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <UserCheck className="h-5 w-5" style={{ color: "var(--circ-accent)" }} aria-hidden="true" />
              <span className="circ-badge" style={{ background: "rgba(159, 193, 225, 0.14)", color: "var(--circ-accent)" }}>Members</span>
            </div>
            <div className="circ-stat-num" style={{ color: "var(--circ-accent)" }}>
              {cardsLoading ? "—" : stats.members}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--circ-muted)" }}>Registered Members</div>
            <div className="circ-stat-bar">
              <div style={{ height: "100%", width: `${stats.memberPct}%`, background: "var(--circ-accent)" }} />
            </div>
          </button>

          <button
            type="button"
            className="circ-stat-card"
            onClick={() => {
              setActiveTab("all");
              setTypeFilter("borrower");
              setPage(1);
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <UserPlus className="h-5 w-5" style={{ color: "var(--circ-accent2)" }} aria-hidden="true" />
              <span className="circ-badge" style={{ background: "rgba(72, 199, 142, 0.14)", color: "var(--circ-accent2)" }}>Borrowers</span>
            </div>
            <div className="circ-stat-num" style={{ color: "var(--circ-accent2)" }}>
              {cardsLoading ? "—" : stats.borrowers}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--circ-muted)" }}>Walk-In Borrowers</div>
            <div className="circ-stat-bar">
              <div style={{ height: "100%", width: `${stats.borrowerPct}%`, background: "var(--circ-accent2)" }} />
            </div>
          </button>

          <button
            type="button"
            className="circ-stat-card"
            onClick={() => {
              setActiveTab("returns");
              setPage(1);
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <ArrowDownLeft className="h-5 w-5" style={{ color: "var(--circ-warn)" }} aria-hidden="true" />
              <span className="circ-badge" style={{ background: "rgba(255, 152, 0, 0.14)", color: "var(--circ-warn)" }}>Returns</span>
            </div>
            <div className="circ-stat-num" style={{ color: "var(--circ-warn)" }}>
              {returnsLoading ? "—" : stats.returned}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--circ-muted)" }}>Books Returned</div>
            <div className="circ-stat-bar">
              <div style={{ height: "100%", width: `${stats.returnPct}%`, background: "var(--circ-warn)" }} />
            </div>
          </button>
        </section>

        {/* Main Table Card */}
        <div className="circ-tbl-card">
          <div className="circ-rec-tabs" role="tablist" aria-label="Records views">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              className={`circ-rec-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("all");
                setPage(1);
              }}
            >
              <TableIcon className="h-4 w-4" aria-hidden="true" />
              All Records
              <span className="circ-badge" style={{ background: "rgba(159, 193, 225, 0.16)" }}>
                {filteredCards.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "returns"}
              className={`circ-rec-tab green ${activeTab === "returns" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("returns");
                setPage(1);
              }}
            >
              <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
              Return History
              <span className="circ-badge" style={{ background: "rgba(72, 199, 142, 0.16)" }}>
                {filteredReturns.length}
              </span>
            </button>
          </div>

          {/* Toolbar */}
          <div className="circ-toolbar">
            <div className="circ-search-bar" style={{ flex: "1 1 220px", minHeight: 42 }}>
              <Search className="h-4 w-4 opacity-60 shrink-0" aria-hidden="true" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={
                  activeTab === "all"
                    ? "Search name, book, or ISBN…"
                    : "Search borrower or book…"
                }
                aria-label="Search records"
              />
            </div>

            {activeTab === "all" && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(
                  [
                    { key: "", label: "All" },
                    { key: "member", label: "Members" },
                    { key: "borrower", label: "Borrowers" },
                    { key: "overdue", label: "Overdue" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.key || "all"}
                    type="button"
                    className={`circ-btn ${typeFilter === f.key ? "active" : ""}`}
                    style={{ minHeight: 40, padding: "0 12px", fontSize: "0.78rem" }}
                    aria-pressed={typeFilter === f.key}
                    onClick={() => {
                      setTypeFilter(f.key);
                      setPage(1);
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter from date"
                style={{ minHeight: 40, borderRadius: 9, padding: "0 10px", background: "var(--circ-input-bg)", border: "1px solid var(--circ-border)", color: "var(--circ-text)", fontSize: "0.78rem" }}
              />
              <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter to date"
                style={{ minHeight: 40, borderRadius: 9, padding: "0 10px", background: "var(--circ-input-bg)", border: "1px solid var(--circ-border)", color: "var(--circ-text)", fontSize: "0.78rem" }}
              />
            </div>
          </div>

          <div aria-live="polite" style={{ padding: "8px 20px", fontSize: "0.74rem", color: "var(--circ-faint)" }}>
            {activeList.length} matching {activeTab === "all" ? "record" : "return"}
            {activeList.length === 1 ? "" : "s"}
          </div>

          {activeError ? (
            <div role="alert" style={{ padding: 36, textAlign: "center", color: "var(--circ-danger)" }}>
              <AlertCircle className="mx-auto mb-2 h-8 w-8" aria-hidden="true" />
              <p style={{ margin: "0 0 12px" }}>Failed to load records. Please try again.</p>
              <button
                type="button"
                className="circ-btn"
                onClick={() => (activeTab === "all" ? mutateCards() : mutateReturns())}
              >
                Retry
              </button>
            </div>
          ) : activeLoading ? (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ height: 48, borderRadius: 10, background: "rgba(159, 193, 225, 0.1)" }} />
              ))}
            </div>
          ) : activeList.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--circ-muted)", fontSize: "0.88rem" }}>
              {activeTab === "all" ? "No records found." : "No return records yet."}
            </div>
          ) : activeTab === "all" ? (
            <>
              {/* Desktop Table */}
              <div className="circ-table-wrap circ-desktop-table">
                <table className="circ-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Type</th>
                      <th scope="col">Books Borrowed</th>
                      <th scope="col">Issued</th>
                      <th scope="col">Due Date</th>
                      <th scope="col">Status</th>
                      <th scope="col">Card</th>
                      <th scope="col">Valid Until</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCards.map((c) => {
                      const isReturned = returnedCardIds.has(c.id);
                      const overdueDays = isReturned ? 0 : getDaysOverdue(c.date_return, todayISO);
                      const hasBooks = (c.books ?? []).length > 0;
                      return (
                        <tr key={c.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{c.fullname}</div>
                            <div style={{ fontSize: "0.73rem", color: "var(--circ-tl)" }}>
                              Card #{c.id}
                            </div>
                          </td>
                          <td>
                            <span
                              className="circ-badge"
                              style={
                                c.card_type_category === "member"
                                  ? { background: "rgba(159, 193, 225, 0.14)", color: "var(--circ-accent)" }
                                  : { background: "rgba(255, 152, 0, 0.14)", color: "var(--circ-warn)" }
                              }
                            >
                              {c.card_type_category === "member" ? "Member" : "Borrower"}
                            </span>
                          </td>
                          <td>
                            {hasBooks ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                {c.books.slice(0, 3).map((b, i) => (
                                  <div key={b.id ?? i} style={{ fontSize: "0.78rem" }}>
                                    • {b.book_title} {b.quantity > 1 ? `(×${b.quantity})` : ""}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.78rem" }}>
                            {c.date_issued || "—"}
                          </td>
                          <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.78rem" }}>
                            {c.date_return || "—"}
                          </td>
                          <td>
                            {isReturned ? (
                              <span className="circ-badge" style={{ background: "rgba(72, 199, 142, 0.15)", color: "var(--circ-accent2)" }}>
                                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Returned
                              </span>
                            ) : overdueDays > 0 ? (
                              <span className="circ-badge" style={{ background: "rgba(255, 99, 99, 0.16)", color: "var(--circ-danger)" }}>
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Overdue ({overdueDays}d)
                              </span>
                            ) : (
                              <span className="circ-badge" style={{ background: "rgba(159, 193, 225, 0.14)", color: "var(--circ-accent)" }}>
                                Borrowed
                              </span>
                            )}
                          </td>
                          <td>{formatCardTypeLabel(c.card_type)}</td>
                          <td style={{ fontSize: "0.76rem", maxWidth: 140 }}>{c.valid_until || "—"}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                className="circ-icon-btn view"
                                onClick={() => setViewCard(c)}
                                aria-label={`View details for ${c.fullname}`}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              </button>
                              {!isReturned && hasBooks && (
                                <button
                                  type="button"
                                  className="circ-icon-btn ret"
                                  onClick={() => setReturnCard(c)}
                                  aria-label={`Process return for ${c.fullname}`}
                                  title="Return Book"
                                >
                                  <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              <button
                                type="button"
                                className="circ-icon-btn edit"
                                onClick={() => setEditCard(c)}
                                aria-label={`Edit or renew card for ${c.fullname}`}
                                title="Edit / Renew"
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="circ-icon-btn del"
                                onClick={() => setDeleteCard(c)}
                                aria-label={`Delete record for ${c.fullname}`}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards (<640px) */}
              <div className="circ-mobile-cards">
                {pagedCards.map((c) => {
                  const isReturned = returnedCardIds.has(c.id);
                  const overdueDays = isReturned ? 0 : getDaysOverdue(c.date_return, todayISO);
                  return (
                    <div key={c.id} className="circ-mobile-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{c.fullname}</strong>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: overdueDays > 0 ? "var(--circ-danger)" : "var(--circ-accent2)" }}>
                          {isReturned ? "Returned" : overdueDays > 0 ? `Overdue (${overdueDays}d)` : "Borrowed"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--circ-tl)" }}>
                        Issued: {c.date_issued || "—"} · Due: {c.date_return || "—"}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        <button type="button" className="circ-btn" style={{ minHeight: 38, fontSize: "0.78rem" }} onClick={() => setViewCard(c)}>
                          View
                        </button>
                        {!isReturned && (c.books ?? []).length > 0 && (
                          <button type="button" className="circ-btn" style={{ minHeight: 38, fontSize: "0.78rem", color: "var(--circ-warn)" }} onClick={() => setReturnCard(c)}>
                            Return
                          </button>
                        )}
                        <button type="button" className="circ-btn" style={{ minHeight: 38, fontSize: "0.78rem" }} onClick={() => setEditCard(c)}>
                          Edit
                        </button>
                        <button type="button" className="circ-btn" style={{ minHeight: 38, fontSize: "0.78rem", color: "var(--circ-danger)" }} onClick={() => setDeleteCard(c)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Return History Table */}
              <div className="circ-table-wrap circ-desktop-table">
                <table className="circ-table">
                  <thead>
                    <tr>
                      <th scope="col">Borrower</th>
                      <th scope="col">Type</th>
                      <th scope="col">Book Returned</th>
                      <th scope="col">Qty</th>
                      <th scope="col">Date Returned</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedReturns.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700 }}>{r.borrower_name}</td>
                        <td>
                          <span className="circ-badge" style={{ background: "rgba(159, 193, 225, 0.14)", color: "var(--circ-accent)" }}>
                            {r.card_category === "member" ? "Member" : "Borrower"}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.book_title}</div>
                          <div style={{ fontSize: "0.73rem", color: "var(--circ-tl)" }}>{r.book_author}</div>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono), monospace", fontWeight: 700 }}>
                          ×{r.qty_returned}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.78rem", color: "var(--circ-accent2)" }}>
                          {r.return_date || "—"}
                        </td>
                        <td>
                          <span className="circ-badge" style={{ background: "rgba(72, 199, 142, 0.15)", color: "var(--circ-accent2)" }}>
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Returned
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="circ-mobile-cards">
                {pagedReturns.map((r) => (
                  <div key={r.id} className="circ-mobile-card">
                    <strong>{r.borrower_name}</strong>
                    <div style={{ fontSize: "0.8rem" }}>{r.book_title} (×{r.qty_returned})</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--circ-accent2)" }}>
                      Returned on {r.return_date || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {!activeLoading && activeList.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderTop: "1px solid var(--circ-border)",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--circ-muted)" }}>
                Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, activeList.length)} of{" "}
                {activeList.length} records
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="circ-icon-btn"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "0 8px", fontSize: "0.8rem", fontWeight: 600 }}>
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="circ-icon-btn"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CardDetailModal card={viewCard} onClose={() => setViewCard(null)} />
      <ProcessReturnModal
        card={returnCard}
        busy={mutating}
        onClose={() => setReturnCard(null)}
        onConfirm={handleConfirmReturn}
      />
      <EditCardModal
        card={editCard}
        busy={mutating}
        onClose={() => setEditCard(null)}
        onSave={handleSaveEdit}
      />
      <DeleteCardModal
        card={deleteCard}
        busy={mutating}
        onClose={() => setDeleteCard(null)}
        onConfirm={handleConfirmDelete}
      />

      {toast && (
        <div className="circ-toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
        </div>
      )}
    </StaffShell>
  );
}
