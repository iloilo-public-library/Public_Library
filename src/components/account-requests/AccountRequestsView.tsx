"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  Hourglass,
  Inbox,
  List,
  RefreshCw,
  Search,
  ShieldAlert,
  UserPlus,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { apiMutate, swrPrivateConfig } from "@/lib/api";
import {
  type AccountRequestRow,
  type RequestSection,
  type RequestType,
  type StatusFilter,
  type ToastState,
  matchesSection,
} from "@/components/account-requests/types";
import { RequestCard } from "@/components/account-requests/RequestCard";
import { RequestDetailModal } from "@/components/account-requests/RequestDetailModal";
import {
  ApproveModal,
  DeleteRecordModal,
  RejectModal,
} from "@/components/account-requests/ActionModals";
import "@/components/account-requests/account-requests.css";

const SECTION_META: Record<
  RequestSection,
  {
    title: string;
    color: string;
    icon: typeof UserPlus;
  }
> = {
  register: {
    title: "New Signup Requests",
    color: "var(--req-reg)",
    icon: UserPlus,
  },
  renew: {
    title: "Card Renewal Requests",
    color: "var(--req-renew)",
    icon: RefreshCw,
  },
  danger: {
    title: "Deactivation & Deletion Requests",
    color: "var(--req-danger)",
    icon: AlertTriangle,
  },
};

export interface AccountRequestsViewProps {
  role?: "admin" | "librarian";
  requestTypes?: RequestType[];
  canApprove?: boolean;
  canReject?: boolean;
  canDelete?: boolean;
  canViewValidId?: boolean;
}

export function AccountRequestsView({
  role = "admin",
  requestTypes = ["register", "renew", "deactivate", "delete"],
  canApprove = true,
  canReject = true,
  canDelete = true,
  canViewValidId = true,
}: AccountRequestsViewProps = {}) {
  const isLibrarian = role === "librarian";
  const renewalOnly =
    isLibrarian || (requestTypes.length === 1 && requestTypes[0] === "renew");

  const [activeSection, setActiveSection] = useState<RequestSection>(
    renewalOnly ? "renew" : "register"
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [detailRow, setDetailRow] = useState<AccountRequestRow | null>(null);
  const [approveRow, setApproveRow] = useState<AccountRequestRow | null>(null);
  const [rejectRow, setRejectRow] = useState<AccountRequestRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<AccountRequestRow | null>(null);
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const { data, error, isLoading, mutate } = useSWR<{ rows?: AccountRequestRow[] }>(
    "/api/admin/data?resource=account_requests",
    swrPrivateConfig
  );

  // 300ms debounced search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string, tone: ToastState["tone"]) => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const allowedTypesSet = useMemo(() => new Set<RequestType>(requestTypes), [requestTypes]);

  const requests = useMemo(
    () => (data?.rows ?? []).filter((r) => allowedTypesSet.has(r.request_type)),
    [data?.rows, allowedTypesSet]
  );

  // Stats across allowed requests
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let signups = 0;
    let renewals = 0;
    let danger = 0;

    for (const r of requests) {
      if (r.status === "pending") pending++;
      else if (r.status === "approved") approved++;
      else if (r.status === "rejected") rejected++;

      if (r.request_type === "register") signups++;
      else if (r.request_type === "renew") renewals++;
      else if (r.request_type === "deactivate" || r.request_type === "delete") danger++;
    }

    return {
      pending,
      approved,
      rejected,
      signups,
      renewals,
      danger,
      total: requests.length,
    };
  }, [requests]);

  // Requests inside active section
  const sectionRows = useMemo(
    () =>
      renewalOnly
        ? requests.filter((r) => r.request_type === "renew")
        : requests.filter((r) => matchesSection(r, activeSection)),
    [requests, activeSection, renewalOnly]
  );

  // Per-section status counts
  const tabCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const r of sectionRows) {
      if (r.status === "pending") pending++;
      else if (r.status === "approved") approved++;
      else if (r.status === "rejected") rejected++;
    }
    return {
      all: sectionRows.length,
      pending,
      approved,
      rejected,
    };
  }, [sectionRows]);

  // Visible cards after status filter + debounced search
  const visibleRows = useMemo(() => {
    return sectionRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!debouncedSearch) return true;
      const haystack = `${r.fullname || ""} ${r.username || ""} ${r.email || ""} ${r.reason || ""}`.toLowerCase();
      return haystack.includes(debouncedSearch);
    });
  }, [sectionRows, statusFilter, debouncedSearch]);

  const handleSwitchSection = (sec: RequestSection) => {
    setActiveSection(sec);
    setStatusFilter("all");
    setSearchInput("");
    setDebouncedSearch("");
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await mutate();
      showToast("Requests refreshed", "success");
    } catch {
      showToast("Failed to refresh", "err");
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirmApprove = async (row: AccountRequestRow, adminNote: string) => {
    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "account_requests",
          action: "approve",
          id: row.id,
          payload: { admin_note: adminNote },
        },
      });
      await mutate();
      setApproveRow(null);
      const msgs: Record<AccountRequestRow["request_type"], string> = {
        delete: "Account permanently deleted",
        deactivate: "Account deactivated successfully",
        renew: "Card renewal approved & applied!",
        register: "Account approved! User has been notified.",
      };
      showToast(msgs[row.request_type] || "Request approved", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to approve request",
        "err"
      );
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmReject = async (row: AccountRequestRow, adminNote: string) => {
    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "account_requests",
          action: "reject",
          id: row.id,
          payload: { admin_note: adminNote },
        },
      });
      await mutate();
      setRejectRow(null);
      showToast(
        row.request_type === "register"
          ? "Registration rejected. User has been notified."
          : isLibrarian && row.request_type === "renew"
            ? "Renewal request rejected"
            : "Request rejected",
        "warn"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to reject request",
        "err"
      );
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmDelete = async (row: AccountRequestRow) => {
    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "DELETE",
        body: {
          resource: "account_requests",
          action: "delete",
          id: row.id,
          payload: {},
        },
      });
      await mutate();
      setDeleteRow(null);
      showToast("Record deleted", "warn");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete record",
        "err"
      );
    } finally {
      setMutating(false);
    }
  };

  const currentSectionMeta = SECTION_META[renewalOnly ? "renew" : activeSection];
  const SectionIcon = currentSectionMeta.icon;

  return (
    <StaffShell title="Account Requests" role={role}>
      <div className="admin-account-requests-page">
        {/* Header */}
        <header className="page-header">
          {isLibrarian ? (
            <>
              <div className="page-badge librarian">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Librarian Panel
              </div>
              <h1 className="page-title">
                Card <span style={{ color: "var(--req-renew)" }}>Renewal</span> Requests
              </h1>
              <p className="page-sub">
                Review and process library card renewal requests submitted by members.
              </p>
            </>
          ) : (
            <>
              <div className="page-badge">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Admin Panel
              </div>
              <h1 className="page-title">Account Requests</h1>
              <p className="page-sub">
                Review and act on user-submitted registrations, deactivation, deletion, and card
                renewal requests.
              </p>
            </>
          )}
        </header>

        {/* Stat Cards (4 for Librarian renewal-only, 6 for Admin) */}
        <section
          className={`stats-row ${renewalOnly ? "stats-row-4" : ""}`}
          aria-label="Account request statistics"
        >
          <div className="stat-card sc-pending">
            <div className="stat-icon">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="stat-num">{isLoading ? "—" : stats.pending}</div>
              <div className="stat-lbl">Pending</div>
            </div>
          </div>

          <div className="stat-card sc-approved">
            <div className="stat-icon">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="stat-num">{isLoading ? "—" : stats.approved}</div>
              <div className="stat-lbl">Approved</div>
            </div>
          </div>

          <div className="stat-card sc-rejected">
            <div className="stat-icon">
              <XCircle className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="stat-num">{isLoading ? "—" : stats.rejected}</div>
              <div className="stat-lbl">Rejected</div>
            </div>
          </div>

          {!renewalOnly && (
            <>
              <div className="stat-card sc-reg">
                <div className="stat-icon">
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="stat-num">{stats.signups}</div>
                  <div className="stat-lbl">Signups</div>
                </div>
              </div>

              <div className="stat-card sc-renew">
                <div className="stat-icon">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="stat-num">{stats.renewals}</div>
                  <div className="stat-lbl">Renewals</div>
                </div>
              </div>
            </>
          )}

          <div className={`stat-card ${renewalOnly ? "sc-renew" : "sc-total"}`}>
            <div className="stat-icon">
              {renewalOnly ? (
                <Archive className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Inbox className="h-4 w-4" aria-hidden="true" />
              )}
            </div>
            <div>
              <div className="stat-num">{isLoading ? "—" : stats.total}</div>
              <div className="stat-lbl">Total</div>
            </div>
          </div>
        </section>

        {/* Section Switcher (Admin only) */}
        {!renewalOnly && (
          <nav className="section-switcher" aria-label="Request categories">
            <span className="section-switcher-lbl">View:</span>
            <button
              type="button"
              className={`sw-btn sw-reg ${activeSection === "register" ? "active" : ""}`}
              aria-pressed={activeSection === "register"}
              onClick={() => handleSwitchSection("register")}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              New Signups
              <span className="sw-badge">{stats.signups}</span>
            </button>

            <button
              type="button"
              className={`sw-btn sw-renew ${activeSection === "renew" ? "active" : ""}`}
              aria-pressed={activeSection === "renew"}
              onClick={() => handleSwitchSection("renew")}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Card Renewals
              <span className="sw-badge">{stats.renewals}</span>
            </button>

            <button
              type="button"
              className={`sw-btn sw-danger ${activeSection === "danger" ? "active" : ""}`}
              aria-pressed={activeSection === "danger"}
              onClick={() => handleSwitchSection("danger")}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Deactivation / Deletion
              <span className="sw-badge">{stats.danger}</span>
            </button>
          </nav>
        )}

        {/* Unified Browse-Catalog Command Search & Status Filter Strip */}
        <div className="mb-5 space-y-2.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="group relative flex-1">
              <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-accent/20 via-accent2/10 to-accent/20 opacity-0 blur transition duration-300 group-focus-within:opacity-100" />
              <div className="relative flex h-[48px] items-center rounded-2xl border border-white/12 bg-bg1/90 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-200 focus-within:border-accent/50 focus-within:bg-bg1">
                <Search className="h-4.5 w-4.5 shrink-0 text-accent/80" aria-hidden="true" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={
                    isLibrarian
                      ? "Search name, email…"
                      : "Search applicant name, email address, or request reason..."
                  }
                  aria-label="Search requests by name, email, or reason"
                  className="w-full bg-transparent py-2 pl-3 pr-3 text-[0.9rem] text-white placeholder:text-white/38 focus:outline-none"
                />
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setDebouncedSearch("");
                    }}
                    aria-label="Clear search"
                    className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/8 text-white/60 transition hover:bg-white/15 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : (
                  <kbd className="hidden shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[0.68rem] font-medium text-white/45 sm:inline-flex">
                    <span>⌘K</span>
                  </kbd>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: "all", label: "All", count: tabCounts.all, icon: List },
                  { key: "pending", label: "Pending", count: tabCounts.pending, icon: Hourglass },
                  { key: "approved", label: "Approved", count: tabCounts.approved, icon: CheckCircle2 },
                  { key: "rejected", label: "Rejected", count: tabCounts.rejected, icon: XCircle },
                ] as const
              ).map((tab) => {
                const active = statusFilter === tab.key;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition-all ${
                      active
                        ? "border-accent/45 bg-accent/15 text-accent shadow-[0_0_20px_rgba(147,197,253,0.14)]"
                        : "border-white/12 bg-bg1/85 text-white/80 hover:border-white/22 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    {isLibrarian && <TabIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                    <span>{tab.label}</span>
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.66rem] text-white/75">
                      {tab.count}
                    </span>
                  </button>
                );
              })}

              {isLibrarian && (
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={refreshing || isLoading}
                  className="inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border border-[#a78bfa]/30 bg-[#a78bfa]/12 px-4 text-xs font-semibold text-[#a78bfa] transition hover:bg-[#a78bfa]/22 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  <span>{refreshing ? "Loading…" : "Refresh"}</span>
                </button>
              )}

              <div className="ml-auto flex h-[48px] items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 text-xs text-tl lg:ml-0">
                <span className="whitespace-nowrap">
                  <strong className="font-semibold text-white">{visibleRows.length}</strong> /{" "}
                  {sectionRows.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section Title Bar */}
        <div className="section-title-bar">
          <div className="section-title-left" style={{ color: currentSectionMeta.color }}>
            <SectionIcon className="h-4 w-4" aria-hidden="true" />
            <span>{currentSectionMeta.title}</span>
          </div>
          <div className="section-count-note" aria-live="polite">
            Showing {visibleRows.length} of {sectionRows.length} request
            {sectionRows.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Cards Grid */}
        <div className="cards-grid">
          {error ? (
            <div className="empty-state" role="alert">
              <WifiOff className="empty-state-icon h-9 w-9" aria-hidden="true" />
              <p>
                {isLibrarian
                  ? "Failed to load. Check connection."
                  : "Failed to load requests. Check your connection or try again."}
              </p>
              <button type="button" className="retry-btn" onClick={() => mutate()}>
                Retry
              </button>
            </div>
          ) : isLoading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="skel-card" style={{ opacity: 1 - i * 0.25 }}>
                <div className="skel-box" style={{ width: "60%" }} />
                <div className="skel-box" style={{ width: "80%" }} />
                <div className="skel-box" style={{ width: "50%" }} />
              </div>
            ))
          ) : visibleRows.length === 0 ? (
            <div className="empty-state">
              <Inbox className="empty-state-icon h-10 w-10" aria-hidden="true" />
              <p>
                {statusFilter === "pending"
                  ? isLibrarian
                    ? "No pending renewals — all clear!"
                    : "No pending requests — all clear!"
                  : "No requests match your filter."}
              </p>
            </div>
          ) : (
            visibleRows.map((row) => (
              <RequestCard
                key={row.id}
                row={row}
                role={role}
                canApprove={canApprove}
                canReject={canReject}
                canDelete={canDelete}
                onViewDetail={(r) => setDetailRow(r)}
                onApprove={(r) => setApproveRow(r)}
                onReject={(r) => setRejectRow(r)}
                onDeleteRecord={(r) => setDeleteRow(r)}
              />
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <RequestDetailModal
        row={detailRow}
        role={role}
        canApprove={canApprove}
        canReject={canReject}
        canViewValidId={canViewValidId}
        onClose={() => setDetailRow(null)}
        onApprove={(r) => setApproveRow(r)}
        onReject={(r) => setRejectRow(r)}
      />

      <ApproveModal
        row={approveRow}
        role={role}
        busy={mutating}
        onClose={() => setApproveRow(null)}
        onConfirm={handleConfirmApprove}
      />

      <RejectModal
        row={rejectRow}
        role={role}
        busy={mutating}
        onClose={() => setRejectRow(null)}
        onConfirm={handleConfirmReject}
      />

      <DeleteRecordModal
        row={deleteRow}
        role={role}
        busy={mutating}
        onClose={() => setDeleteRow(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Toast */}
      {toast && (
        <div className="req-toast" role="status" aria-live="polite">
          {toast.tone === "success" ? (
            <CheckCircle2 className="h-4 w-4" style={{ color: "#48c78e" }} aria-hidden="true" />
          ) : toast.tone === "warn" ? (
            <AlertTriangle className="h-4 w-4" style={{ color: "#f6b93b" }} aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4" style={{ color: "#e05c5c" }} aria-hidden="true" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </StaffShell>
  );
}
