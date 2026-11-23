"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
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

export default function AdminAccountRequestsPage() {
  const [activeSection, setActiveSection] = useState<RequestSection>("register");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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

  const requests = useMemo(() => data?.rows ?? [], [data?.rows]);

  // Global stats across all requests
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
    () => requests.filter((r) => matchesSection(r, activeSection)),
    [requests, activeSection]
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

  const currentSectionMeta = SECTION_META[activeSection];
  const SectionIcon = currentSectionMeta.icon;

  return (
    <StaffShell title="Account Requests" role="admin">
      <div className="admin-account-requests-page">
        {/* Header */}
        <header className="page-header">
          <div className="page-badge">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Admin Panel
          </div>
          <h1 className="page-title">Account Requests</h1>
          <p className="page-sub">
            Review and act on user-submitted registrations, deactivation, deletion, and card
            renewal requests.
          </p>
        </header>

        {/* 6 Stat Cards */}
        <section className="stats-row" aria-label="Account request statistics">
          <div className="stat-card sc-pending">
            <div className="stat-icon">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="stat-num">{stats.pending}</div>
              <div className="stat-lbl">Pending</div>
            </div>
          </div>

          <div className="stat-card sc-approved">
            <div className="stat-icon">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="stat-num">{stats.approved}</div>
              <div className="stat-lbl">Approved</div>
            </div>
          </div>

          <div className="stat-card sc-rejected">
            <div className="stat-icon">
              <XCircle className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="stat-num">{stats.rejected}</div>
              <div className="stat-lbl">Rejected</div>
            </div>
          </div>

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

          <div className="stat-card sc-total">
            <div className="stat-icon">
              <Inbox className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="stat-num">{stats.total}</div>
              <div className="stat-lbl">Total</div>
            </div>
          </div>
        </section>

        {/* Section Switcher */}
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

        {/* Status Filter Strip + Search */}
        <div className="filter-strip">
          {(
            [
              { key: "all", label: "All", count: tabCounts.all },
              { key: "pending", label: "Pending", count: tabCounts.pending },
              { key: "approved", label: "Approved", count: tabCounts.approved },
              { key: "rejected", label: "Rejected", count: tabCounts.rejected },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`filter-tab ${statusFilter === tab.key ? "active" : ""}`}
              aria-pressed={statusFilter === tab.key}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
              <span className="tab-cnt">{tab.count}</span>
            </button>
          ))}

          <div className="search-wrap">
            <Search className="search-ico h-4 w-4" aria-hidden="true" />
            <input
              type="text"
              className="search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email…"
              aria-label="Search requests by name, email, or reason"
            />
            {searchInput && (
              <button
                type="button"
                className="search-clear"
                onClick={() => {
                  setSearchInput("");
                  setDebouncedSearch("");
                }}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Cards Grid */}
        <div className="cards-grid">
          {error ? (
            <div className="empty-state" role="alert">
              <WifiOff className="empty-state-icon h-9 w-9" aria-hidden="true" />
              <p>Failed to load requests. Check your connection or try again.</p>
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
                  ? "No pending requests — all clear!"
                  : "No requests match your filter."}
              </p>
            </div>
          ) : (
            visibleRows.map((row) => (
              <RequestCard
                key={row.id}
                row={row}
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
        onClose={() => setDetailRow(null)}
        onApprove={(r) => setApproveRow(r)}
        onReject={(r) => setRejectRow(r)}
      />

      <ApproveModal
        row={approveRow}
        busy={mutating}
        onClose={() => setApproveRow(null)}
        onConfirm={handleConfirmApprove}
      />

      <RejectModal
        row={rejectRow}
        busy={mutating}
        onClose={() => setRejectRow(null)}
        onConfirm={handleConfirmReject}
      />

      <DeleteRecordModal
        row={deleteRow}
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
