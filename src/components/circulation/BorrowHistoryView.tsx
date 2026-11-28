"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  Pencil,
  RotateCw,
  Search,
  ShieldAlert,
  Table as TableIcon,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { apiMutate, swrPrivateConfig } from "@/lib/api";
import {
  type CirculationToast,
  type LibraryCardRow,
  type ReturnItemRow,
  formatCardTypeLabel,
  formatPhp,
  getDaysOverdue,
  getManilaTodayISO,
} from "./types";
import {
  CardDetailModal,
  DeleteCardModal,
  DeleteReturnModal,
  EditCardModal,
  type EditCardPayload,
  MarkIncidentModal,
  ProcessReturnModal,
  type ProcessReturnPayload,
  RecordPaymentModal,
  RenewLoanModal,
  WaiveFineModal,
} from "./BorrowHistoryModals";
import "./circulation.css";

const PAGE_SIZE = 15;

export interface BorrowHistoryViewProps {
  role?: "admin" | "librarian";
  canReturn?: boolean;
  canRenew?: boolean;
  canMarkLost?: boolean;
  canWaiveFine?: boolean;
  canExport?: boolean;
  canDelete?: boolean;
}

interface PaginatedCardsResponse {
  rows?: LibraryCardRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

interface PaginatedReturnsResponse {
  rows?: ReturnItemRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

type CardFilterValue = "" | "member" | "borrower" | "active" | "overdue" | "returned" | "lost";

export function BorrowHistoryView({
  role = "admin",
  canReturn = true,
  canRenew = true,
  canMarkLost,
  canWaiveFine,
  canExport = true,
  canDelete = true,
}: BorrowHistoryViewProps = {}) {
  const todayISO = useMemo(() => getManilaTodayISO(), []);
  const isLibrarian = role === "librarian";

  // Hard RBAC guards matching backend rules
  const effectiveCanMarkLost = canMarkLost ?? true;
  const effectiveCanWaiveFine = !isLibrarian && (canWaiveFine ?? true);
  const effectiveCanDeleteReturn = !isLibrarian && canDelete;

  const [activeTab, setActiveTab] = useState<"all" | "returns">("all");
  const [typeFilter, setTypeFilter] = useState<CardFilterValue>("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [viewCard, setViewCard] = useState<LibraryCardRow | null>(null);
  const [returnCard, setReturnCard] = useState<LibraryCardRow | null>(null);
  const [editCard, setEditCard] = useState<LibraryCardRow | null>(null);
  const [renewCard, setRenewCard] = useState<LibraryCardRow | null>(null);
  const [incidentCard, setIncidentCard] = useState<LibraryCardRow | null>(null);
  const [waiveCard, setWaiveCard] = useState<LibraryCardRow | null>(null);
  const [paymentCard, setPaymentCard] = useState<LibraryCardRow | null>(null);
  const [deleteCard, setDeleteCard] = useState<LibraryCardRow | null>(null);
  const [deleteReturnItem, setDeleteReturnItem] = useState<ReturnItemRow | null>(null);

  const [mutating, setMutating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<CirculationToast | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const cardsQueryUrl = useMemo(() => {
    const params = new URLSearchParams({
      resource: "library_cards",
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (debouncedQ) params.set("q", debouncedQ);
    if (
      typeFilter === "member" ||
      typeFilter === "borrower" ||
      typeFilter === "active" ||
      typeFilter === "returned" ||
      typeFilter === "lost"
    ) {
      params.set("status", typeFilter);
    }
    if (typeFilter === "overdue") {
      params.set("overdue", "true");
    }
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    return `/api/admin/data?${params.toString()}`;
  }, [page, debouncedQ, typeFilter, dateFrom, dateTo]);

  const returnsQueryUrl = useMemo(() => {
    const params = new URLSearchParams({
      resource: "returns",
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (debouncedQ) params.set("q", debouncedQ);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    return `/api/admin/data?${params.toString()}`;
  }, [page, debouncedQ, dateFrom, dateTo]);

  const {
    data: cardsData,
    error: cardsError,
    isLoading: cardsLoading,
    mutate: mutateCards,
  } = useSWR<PaginatedCardsResponse>(
    activeTab === "all" ? cardsQueryUrl : null,
    swrPrivateConfig
  );

  const {
    data: returnsData,
    error: returnsError,
    isLoading: returnsLoading,
    mutate: mutateReturns,
  } = useSWR<PaginatedReturnsResponse>(
    activeTab === "returns" ? returnsQueryUrl : null,
    swrPrivateConfig
  );

  // Lightweight server totals for KPI cards and tab counts
  const { data: totalStat, mutate: mutateTotalStat } = useSWR<PaginatedCardsResponse>(
    "/api/admin/data?resource=library_cards&page=1&pageSize=1",
    swrPrivateConfig
  );
  const { data: memberStat, mutate: mutateMemberStat } = useSWR<PaginatedCardsResponse>(
    "/api/admin/data?resource=library_cards&page=1&pageSize=1&status=member",
    swrPrivateConfig
  );
  const { data: borrowerStat, mutate: mutateBorrowerStat } = useSWR<PaginatedCardsResponse>(
    "/api/admin/data?resource=library_cards&page=1&pageSize=1&status=borrower",
    swrPrivateConfig
  );
  const { data: returnStat, mutate: mutateReturnStat } = useSWR<PaginatedReturnsResponse>(
    "/api/admin/data?resource=returns&page=1&pageSize=1",
    swrPrivateConfig
  );

  const revalidateAll = useCallback(async () => {
    await Promise.all([
      mutateCards(),
      mutateReturns(),
      mutateTotalStat(),
      mutateMemberStat(),
      mutateBorrowerStat(),
      mutateReturnStat(),
    ]);
  }, [
    mutateCards,
    mutateReturns,
    mutateTotalStat,
    mutateMemberStat,
    mutateBorrowerStat,
    mutateReturnStat,
  ]);

  // Cmd/Ctrl+K shortcut focuses search input
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQ(searchInput.trim());
      setPage(1);
    }, 280);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((message: string, tone: CirculationToast["tone"] = "info") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const stats = useMemo(() => {
    const total = Number(totalStat?.total ?? 0);
    const members = Number(memberStat?.total ?? 0);
    const borrowers = Number(borrowerStat?.total ?? 0);
    const returned = Number(returnStat?.total ?? 0);
    return {
      total,
      members,
      borrowers,
      returned,
      memberPct: total ? Math.round((members / total) * 100) : 0,
      borrowerPct: total ? Math.round((borrowers / total) * 100) : 0,
      returnPct: total ? Math.min(100, Math.round((returned / total) * 100)) : 0,
    };
  }, [totalStat?.total, memberStat?.total, borrowerStat?.total, returnStat?.total]);

  const pagedCards = useMemo(() => cardsData?.rows ?? [], [cardsData?.rows]);
  const pagedReturns = useMemo(() => returnsData?.rows ?? [], [returnsData?.rows]);
  const activeTotal =
    activeTab === "all"
      ? Number(cardsData?.total ?? pagedCards.length)
      : Number(returnsData?.total ?? pagedReturns.length);
  const totalPages =
    activeTab === "all"
      ? Math.max(1, Number(cardsData?.totalPages ?? 1))
      : Math.max(1, Number(returnsData?.totalPages ?? 1));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;

  const handleConfirmReturn = async (card: LibraryCardRow, payload: ProcessReturnPayload) => {
    setMutating(true);
    try {
      const res = (await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "library_cards",
          action: "return_books",
          id: card.id,
          payload,
        },
      })) as { overdue_days?: number; fine_amount?: number };
      await revalidateAll();
      setReturnCard(null);
      const fine = Number(res.fine_amount ?? 0);
      const overdue = Number(res.overdue_days ?? 0);
      showToast(
        fine > 0
          ? `Books returned (${overdue}d overdue · Fine ${formatPhp(fine)}).`
          : "Books returned successfully!",
        "success"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Return failed.", "danger");
    } finally {
      setMutating(false);
    }
  };

  const handleSaveEdit = async (card: LibraryCardRow, payload: EditCardPayload) => {
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
      await revalidateAll();
      setEditCard(null);
      showToast("Record updated!", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed.", "danger");
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmRenew = async (card: LibraryCardRow) => {
    setMutating(true);
    try {
      const res = (await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "library_cards",
          action: "renew",
          id: card.id,
          payload: {},
        },
      })) as { date_return?: string };
      await revalidateAll();
      setRenewCard(null);
      showToast(
        res.date_return
          ? `Loan renewed — new due date: ${res.date_return}`
          : "Loan renewed successfully!",
        "success"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Renewal failed.", "danger");
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmIncident = async (
    card: LibraryCardRow,
    payload: { kind: "damaged" | "lost"; card_book_id: number; reason: string; condition_notes?: string }
  ) => {
    setMutating(true);
    try {
      const action = payload.kind === "lost" ? "mark_lost" : "mark_damaged";
      const res = (await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "library_cards",
          action,
          id: card.id,
          payload: {
            card_book_id: payload.card_book_id,
            reason: payload.reason,
            ...(payload.condition_notes ? { condition_notes: payload.condition_notes } : {}),
          },
        },
      })) as { fee_amount?: number };
      await revalidateAll();
      setIncidentCard(null);
      showToast(
        `Marked ${payload.kind} — assessed fee: ${formatPhp(res.fee_amount ?? 0)}.`,
        "success"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to record incident.", "danger");
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmWaive = async (card: LibraryCardRow, reason: string) => {
    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "library_cards",
          action: "waive_fine",
          id: card.id,
          payload: { reason },
        },
      });
      await revalidateAll();
      setWaiveCard(null);
      showToast(`Fine waived for Card #${card.id}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to waive fine.", "danger");
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmPayment = async (
    card: LibraryCardRow,
    payload: {
      amount: number;
      payment_method: "cash" | "gcash" | "bank" | "other";
      idempotency_key: string;
      note?: string;
    }
  ) => {
    setMutating(true);
    try {
      const res = (await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "library_cards",
          action: "record_fine_payment",
          id: card.id,
          payload,
        },
      })) as { amount_paid?: number; remaining_balance?: number };
      await revalidateAll();
      setPaymentCard(null);
      showToast(
        `Recorded payment ${formatPhp(res.amount_paid ?? payload.amount)} · Remaining: ${formatPhp(res.remaining_balance ?? 0)}.`,
        "success"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Payment failed.", "danger");
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
      await revalidateAll();
      setDeleteCard(null);
      showToast("Record deleted.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed.", "danger");
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmDeleteReturn = async (item: ReturnItemRow) => {
    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "DELETE",
        body: {
          resource: "returns",
          action: "delete",
          id: item.id,
          payload: {},
        },
      });
      await revalidateAll();
      setDeleteReturnItem(null);
      showToast("Return item deleted.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete return record.", "danger");
    } finally {
      setMutating(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        resource: activeTab === "returns" ? "returns" : "library_cards",
        format: "csv",
      });
      if (debouncedQ) params.set("q", debouncedQ);
      if (activeTab === "all") {
        if (
          typeFilter === "member" ||
          typeFilter === "borrower" ||
          typeFilter === "active" ||
          typeFilter === "returned" ||
          typeFilter === "lost"
        ) {
          params.set("status", typeFilter);
        }
        if (typeFilter === "overdue") {
          params.set("overdue", "true");
        }
      }
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const res = await fetch(`/api/admin/data?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "CSV export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeTab === "returns" ? "return_history" : "library_records"}_${todayISO}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Server CSV exported!", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "CSV export failed.", "danger");
    } finally {
      setExporting(false);
    }
  };

  const activeError = activeTab === "all" ? cardsError : returnsError;
  const activeLoading = activeTab === "all" ? cardsLoading : returnsLoading;
  const currentListCount = activeTab === "all" ? pagedCards.length : pagedReturns.length;

  return (
    <StaffShell title="Borrow History" role={role}>
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

          {canExport && (
            <button type="button" className="circ-btn export" disabled={exporting} onClick={handleExportCSV}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          )}
        </header>

        {/* 4 Stat Cards */}
        <section className="circ-stats-grid" aria-label="Circulation summary statistics">
          <button
            type="button"
            className="circ-stat-card"
            onClick={() => {
              setActiveTab("all");
              setTypeFilter("");
              setPage(1);
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <CreditCard className="h-5 w-5" style={{ color: "var(--circ-tl)" }} aria-hidden="true" />
              <span className="circ-badge" style={{ background: "rgba(218, 232, 245, 0.12)" }}>All</span>
            </div>
            <div className="circ-stat-num">{totalStat ? stats.total : "—"}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--circ-muted)" }}>Total Library Cards</div>
            <div className="circ-stat-bar">
              <div style={{ height: "100%", width: "100%", background: "var(--circ-tl)" }} />
            </div>
          </button>

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
              {memberStat ? stats.members : "—"}
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
              {borrowerStat ? stats.borrowers : "—"}
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
              {returnStat ? stats.returned : "—"}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--circ-muted)" }}>Returned Items</div>
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
                {activeTab === "all" ? activeTotal : stats.total}
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
                {activeTab === "returns" ? activeTotal : stats.returned}
              </span>
            </button>
          </div>

          {/* Search & Server Filters Toolbar */}
          <div className="p-4 border-b border-white/8 space-y-2.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="group relative flex-1">
                <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-accent/20 via-accent2/10 to-accent/20 opacity-0 blur transition duration-300 group-focus-within:opacity-100" />
                <div className="relative flex h-[48px] items-center rounded-2xl border border-white/12 bg-bg1/90 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-200 focus-within:border-accent/50 focus-within:bg-bg1">
                  <Search className="h-4.5 w-4.5 shrink-0 text-accent/80" aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={
                      activeTab === "all"
                        ? "Search borrower name, book title, or ISBN… (⌘K)"
                        : "Search borrower name, returned book title, or ISBN… (⌘K)"
                    }
                    aria-label="Search records"
                    className="w-full bg-transparent py-2 pl-3 pr-3 text-[0.9rem] text-white placeholder:text-white/38 focus:outline-none"
                  />
                  {searchInput ? (
                    <button
                      type="button"
                      onClick={() => setSearchInput("")}
                      aria-label="Clear search"
                      className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/8 text-white/60 transition hover:bg-white/15 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <kbd className="hidden shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[0.68rem] font-medium text-white/45 sm:inline-flex">
                      <span>⌘K</span>
                    </kbd>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeTab === "all" && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { key: "", label: "All" },
                        { key: "member", label: "Members" },
                        { key: "borrower", label: "Borrowers" },
                        { key: "active", label: "Active" },
                        { key: "overdue", label: "Overdue" },
                        { key: "returned", label: "Returned" },
                        { key: "lost", label: "Lost" },
                      ] as const
                    ).map((f) => {
                      const active = typeFilter === f.key;
                      return (
                        <button
                          key={f.key || "all"}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setTypeFilter(f.key);
                            setPage(1);
                          }}
                          className={`inline-flex h-[42px] cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all ${
                            active
                              ? f.key === "overdue" || f.key === "lost"
                                ? "border-danger/45 bg-danger/15 text-danger"
                                : "border-accent/45 bg-accent/15 text-accent"
                              : "border-white/12 bg-bg1/85 text-white/80 hover:border-white/22 hover:bg-white/8 hover:text-white"
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Filter from date"
                    className="h-[42px] rounded-xl border border-white/12 bg-bg1/85 px-3 text-xs font-medium text-white focus:border-accent/50 focus:outline-none"
                  />
                  <span className="text-xs text-tl/60">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Filter to date"
                    className="h-[42px] rounded-xl border border-white/12 bg-bg1/85 px-3 text-xs font-medium text-white focus:border-accent/50 focus:outline-none"
                  />
                </div>

                <div className="ml-auto flex h-[42px] items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 text-xs text-tl lg:ml-0">
                  <span className="whitespace-nowrap">
                    <strong className="font-semibold text-white">{activeTotal}</strong>{" "}
                    {activeTab === "all" ? "record" : "return"}
                    {activeTotal === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>
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
          ) : currentListCount === 0 ? (
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
                      <th scope="col">Issued / Due</th>
                      <th scope="col">Status</th>
                      <th scope="col">Fine</th>
                      <th scope="col">Registered By</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCards.map((c) => {
                      const books = c.books ?? [];
                      const hasBooks = books.length > 0;
                      const isReturned = Boolean(c.is_returned || c.status === "returned");
                      const isLost = c.status === "lost";
                      const isClosed = isReturned || isLost;
                      const hasActiveBooks = books.some((b) => {
                        const ls = String(b.loan_status ?? "borrowed");
                        return ls === "borrowed" || ls === "overdue";
                      });
                      const overdueDays =
                        typeof c.overdue_days === "number"
                          ? c.overdue_days
                          : isReturned
                            ? 0
                            : getDaysOverdue(c.date_return, todayISO);
                      const status = c.status ?? (isReturned ? "returned" : overdueDays > 0 ? "overdue" : "active");
                      const fineVal = Number(c.fine_amount ?? 0);
                      const renewalsUsed = (c.renewal1_checked ? 1 : 0) + (c.renewal2_checked ? 1 : 0);

                      return (
                        <tr key={c.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{c.fullname}</div>
                            <div style={{ fontSize: "0.73rem", color: "var(--circ-tl)" }}>
                              Card #{c.id} · {formatCardTypeLabel(c.card_type)}
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
                                {books.slice(0, 2).map((b, i) => (
                                  <div key={b.id ?? i} style={{ fontSize: "0.78rem" }}>
                                    • {b.book_id ? `[#${b.book_id}] ` : ""}
                                    {b.book_title}
                                    {b.quantity > 1 ? ` (×${b.quantity})` : ""}
                                  </div>
                                ))}
                                {books.length > 2 && (
                                  <span
                                    className="circ-badge"
                                    style={{
                                      width: "fit-content",
                                      fontSize: "0.68rem",
                                      background: "rgba(159, 193, 225, 0.14)",
                                      color: "var(--circ-accent)",
                                    }}
                                  >
                                    +{books.length - 2} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem" }}>
                            <div>{c.date_issued || "—"}</div>
                            <div style={{ color: "var(--circ-tl)" }}>Due: {c.date_return || "—"}</div>
                          </td>
                          <td>
                            {status === "returned" ? (
                              <span className="circ-badge" style={{ background: "rgba(72, 199, 142, 0.15)", color: "var(--circ-accent2)" }}>
                                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Returned
                              </span>
                            ) : status === "lost" ? (
                              <span className="circ-badge" style={{ background: "rgba(255, 99, 99, 0.18)", color: "var(--circ-danger)" }}>
                                <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Lost
                              </span>
                            ) : status === "overdue" || overdueDays > 0 ? (
                              <span className="circ-badge" style={{ background: "rgba(255, 99, 99, 0.16)", color: "var(--circ-danger)" }}>
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Overdue ({overdueDays}d)
                              </span>
                            ) : (
                              <span className="circ-badge" style={{ background: "rgba(159, 193, 225, 0.14)", color: "var(--circ-accent)" }}>
                                Active
                              </span>
                            )}
                          </td>
                          <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.78rem", fontWeight: 600 }}>
                            {c.fine_waived ? (
                              <span style={{ color: "var(--circ-accent2)" }}>Waived</span>
                            ) : fineVal > 0 ? (
                              <span style={{ color: "var(--circ-danger)" }}>{formatPhp(fineVal)}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={{ fontSize: "0.76rem", color: "var(--circ-tl)" }}>
                            {c.registered_by_name || "—"}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="circ-icon-btn view"
                                onClick={() => setViewCard(c)}
                                aria-label={`View details for ${c.fullname}`}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              </button>
                              {canReturn && !isClosed && hasActiveBooks && (
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
                              {canRenew && !isClosed && hasActiveBooks && renewalsUsed < 2 && (
                                <button
                                  type="button"
                                  className="circ-icon-btn view"
                                  onClick={() => setRenewCard(c)}
                                  aria-label={`Renew loan for ${c.fullname}`}
                                  title="Renew Loan"
                                >
                                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              {canRenew && !isClosed && (
                                <button
                                  type="button"
                                  className="circ-icon-btn edit"
                                  onClick={() => setEditCard(c)}
                                  aria-label={`Edit card for ${c.fullname}`}
                                  title="Edit Card"
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              {effectiveCanMarkLost && !isClosed && hasActiveBooks && (
                                <button
                                  type="button"
                                  className="circ-icon-btn del"
                                  onClick={() => setIncidentCard(c)}
                                  aria-label={`Report damaged or lost book for ${c.fullname}`}
                                  title="Report Damaged / Lost"
                                >
                                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              {fineVal > 0 && !c.fine_waived && (
                                <button
                                  type="button"
                                  className="circ-icon-btn ret"
                                  onClick={() => setPaymentCard(c)}
                                  aria-label={`Record fine payment for ${c.fullname}`}
                                  title="Record Fine Payment"
                                >
                                  <Banknote className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              {effectiveCanWaiveFine && fineVal > 0 && !c.fine_waived && (
                                <button
                                  type="button"
                                  className="circ-icon-btn view"
                                  onClick={() => setWaiveCard(c)}
                                  aria-label={`Waive fine for ${c.fullname}`}
                                  title="Waive Fine (Admin)"
                                >
                                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  className="circ-icon-btn del"
                                  onClick={() => setDeleteCard(c)}
                                  aria-label={`Delete record for ${c.fullname}`}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
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
                  const books = c.books ?? [];
                  const isReturned = Boolean(c.is_returned || c.status === "returned");
                  const isClosed = isReturned || c.status === "lost";
                  const hasActiveBooks = books.some((b) => {
                    const ls = String(b.loan_status ?? "borrowed");
                    return ls === "borrowed" || ls === "overdue";
                  });
                  const overdueDays =
                    typeof c.overdue_days === "number"
                      ? c.overdue_days
                      : isReturned
                        ? 0
                        : getDaysOverdue(c.date_return, todayISO);
                  const fineVal = Number(c.fine_amount ?? 0);
                  const renewalsUsed = (c.renewal1_checked ? 1 : 0) + (c.renewal2_checked ? 1 : 0);

                  return (
                    <div key={c.id} className="circ-mobile-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <strong>{c.fullname}</strong>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: overdueDays > 0 || c.status === "lost" ? "var(--circ-danger)" : "var(--circ-accent2)" }}>
                          {isReturned ? "Returned" : c.status === "lost" ? "Lost" : overdueDays > 0 ? `Overdue (${overdueDays}d)` : "Active"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--circ-tl)" }}>
                        Card #{c.id} · Issued: {c.date_issued || "—"} · Due: {c.date_return || "—"}
                        {fineVal > 0 && !c.fine_waived ? ` · Fine: ${formatPhp(fineVal)}` : c.fine_waived ? " · Waived" : ""}
                      </div>
                      <div style={{ fontSize: "0.76rem", opacity: 0.85 }}>
                        {books.slice(0, 2).map((b) => b.book_title).join(", ")}
                        {books.length > 2 ? ` (+${books.length - 2} more)` : ""}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        <button type="button" className="circ-btn" style={{ minHeight: 36, fontSize: "0.75rem" }} onClick={() => setViewCard(c)}>
                          View
                        </button>
                        {canReturn && !isClosed && hasActiveBooks && (
                          <button type="button" className="circ-btn" style={{ minHeight: 36, fontSize: "0.75rem", color: "var(--circ-warn)" }} onClick={() => setReturnCard(c)}>
                            Return
                          </button>
                        )}
                        {canRenew && !isClosed && hasActiveBooks && renewalsUsed < 2 && (
                          <button type="button" className="circ-btn" style={{ minHeight: 36, fontSize: "0.75rem" }} onClick={() => setRenewCard(c)}>
                            Renew
                          </button>
                        )}
                        {canRenew && !isClosed && (
                          <button type="button" className="circ-btn" style={{ minHeight: 36, fontSize: "0.75rem" }} onClick={() => setEditCard(c)}>
                            Edit
                          </button>
                        )}
                        {effectiveCanMarkLost && !isClosed && hasActiveBooks && (
                          <button type="button" className="circ-btn" style={{ minHeight: 36, fontSize: "0.75rem", color: "var(--circ-danger)" }} onClick={() => setIncidentCard(c)}>
                            Incident
                          </button>
                        )}
                        {fineVal > 0 && !c.fine_waived && (
                          <button type="button" className="circ-btn" style={{ minHeight: 36, fontSize: "0.75rem", color: "var(--circ-accent2)" }} onClick={() => setPaymentCard(c)}>
                            Pay Fine
                          </button>
                        )}
                        {effectiveCanWaiveFine && fineVal > 0 && !c.fine_waived && (
                          <button type="button" className="circ-btn" style={{ minHeight: 36, fontSize: "0.75rem" }} onClick={() => setWaiveCard(c)}>
                            Waive
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" className="circ-btn" style={{ minHeight: 36, fontSize: "0.75rem", color: "var(--circ-danger)" }} onClick={() => setDeleteCard(c)}>
                            Delete
                          </button>
                        )}
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
                      <th scope="col">Book Returned</th>
                      <th scope="col">Qty</th>
                      <th scope="col">Condition</th>
                      <th scope="col">Date Returned</th>
                      <th scope="col">Overdue / Fine</th>
                      <th scope="col">Processed By</th>
                      {effectiveCanDeleteReturn && <th scope="col">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedReturns.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{r.borrower_name}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--circ-tl)" }}>
                            Card #{r.card_id ?? "—"} · {r.card_category === "member" ? "Member" : "Borrower"}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.book_title}</div>
                          <div style={{ fontSize: "0.73rem", color: "var(--circ-tl)" }}>{r.book_author}</div>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono), monospace", fontWeight: 700 }}>
                          ×{r.qty_returned}
                        </td>
                        <td>
                          <span
                            className="circ-badge"
                            style={
                              r.return_condition === "Damaged" ||
                              r.return_condition === "Destroyed" ||
                              r.return_condition === "Lost"
                                ? { background: "rgba(255, 99, 99, 0.16)", color: "var(--circ-danger)" }
                                : { background: "rgba(72, 199, 142, 0.15)", color: "var(--circ-accent2)" }
                            }
                          >
                            {r.return_condition || "Good"}
                          </span>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.78rem", color: "var(--circ-accent2)" }}>
                          {r.return_date || "—"}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.76rem" }}>
                          {r.fine_waived ? (
                            <span style={{ color: "var(--circ-accent2)" }}>Waived</span>
                          ) : Number(r.fine_amount ?? 0) > 0 ? (
                            <span style={{ color: "var(--circ-danger)" }}>
                              {r.overdue_days ? `${r.overdue_days}d · ` : ""}
                              {formatPhp(r.fine_amount)}
                            </span>
                          ) : r.overdue_days && r.overdue_days > 0 ? (
                            `${r.overdue_days}d`
                          ) : (
                            "On time"
                          )}
                        </td>
                        <td style={{ fontSize: "0.76rem", color: "var(--circ-tl)" }}>
                          {r.processed_by_name || "—"}
                        </td>
                        {effectiveCanDeleteReturn && (
                          <td>
                            <button
                              type="button"
                              className="circ-icon-btn del"
                              onClick={() => setDeleteReturnItem(r)}
                              aria-label={`Delete return item ${r.book_title}`}
                              title="Delete Return Record (Admin)"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="circ-mobile-cards">
                {pagedReturns.map((r) => (
                  <div key={r.id} className="circ-mobile-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{r.borrower_name}</strong>
                      <span style={{ fontSize: "0.74rem", fontWeight: 600 }}>{r.return_condition || "Good"}</span>
                    </div>
                    <div style={{ fontSize: "0.8rem" }}>{r.book_title} (×{r.qty_returned})</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--circ-tl)" }}>
                      Returned: {r.return_date || "—"} · By: {r.processed_by_name || "—"}
                      {r.fine_waived
                        ? " · Fine waived"
                        : Number(r.fine_amount ?? 0) > 0
                          ? ` · Fine: ${formatPhp(r.fine_amount)}`
                          : ""}
                    </div>
                    {effectiveCanDeleteReturn && (
                      <button
                        type="button"
                        className="circ-btn"
                        style={{ minHeight: 34, fontSize: "0.74rem", color: "var(--circ-danger)", width: "fit-content" }}
                        onClick={() => setDeleteReturnItem(r)}
                      >
                        Delete Return
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Server Pagination */}
          {!activeLoading && currentListCount > 0 && (
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
                Showing {startIdx + 1}–{Math.min(startIdx + currentListCount, activeTotal)} of{" "}
                {activeTotal} records
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
      <CardDetailModal card={viewCard} role={role} onClose={() => setViewCard(null)} />
      <ProcessReturnModal
        card={returnCard}
        role={role}
        busy={mutating}
        onClose={() => setReturnCard(null)}
        onConfirm={handleConfirmReturn}
      />
      <EditCardModal
        card={editCard}
        role={role}
        busy={mutating}
        onClose={() => setEditCard(null)}
        onSave={handleSaveEdit}
        onRequestRenew={canRenew ? (card) => setRenewCard(card) : undefined}
      />
      <RenewLoanModal
        card={renewCard}
        busy={mutating}
        onClose={() => setRenewCard(null)}
        onConfirm={handleConfirmRenew}
      />
      <MarkIncidentModal
        card={incidentCard}
        busy={mutating}
        onClose={() => setIncidentCard(null)}
        onConfirm={handleConfirmIncident}
      />
      {effectiveCanWaiveFine && (
        <WaiveFineModal
          card={waiveCard}
          busy={mutating}
          onClose={() => setWaiveCard(null)}
          onConfirm={handleConfirmWaive}
        />
      )}
      <RecordPaymentModal
        card={paymentCard}
        busy={mutating}
        onClose={() => setPaymentCard(null)}
        onConfirm={handleConfirmPayment}
      />
      <DeleteCardModal
        card={deleteCard}
        busy={mutating}
        onClose={() => setDeleteCard(null)}
        onConfirm={handleConfirmDelete}
      />
      {effectiveCanDeleteReturn && (
        <DeleteReturnModal
          item={deleteReturnItem}
          busy={mutating}
          onClose={() => setDeleteReturnItem(null)}
          onConfirm={handleConfirmDeleteReturn}
        />
      )}

      {toast && (
        <div className="circ-toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
        </div>
      )}
    </StaffShell>
  );
}
