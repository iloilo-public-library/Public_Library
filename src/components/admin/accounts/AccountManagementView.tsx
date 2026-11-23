"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  IdCard,
  KeyRound,
  Lock,
  Moon,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Unlock,
  Users,
  UserX,
  X,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { apiMutate, swrPrivateConfig } from "@/lib/api";
import {
  AddAccountModal,
  ConfirmActionModal,
  ResetPasswordModal,
  UserDetailsModal,
} from "./AccountModals";
import {
  formatDateOnly,
  formatDateTime,
  formatTimeOnly,
  type AccountManagementConfig,
  type ManagedAccountRow,
} from "./types";
import "./accounts.css";

interface AccountsApiResponse {
  rows: ManagedAccountRow[];
}

interface SessionApiResponse {
  authenticated: boolean;
  user: { id: number; role: string; email: string } | null;
}

type FilterKey = "all" | "active" | "deactivated" | "locked";
type SortKey = "name" | "registered" | "attempts";
type SortDir = "asc" | "desc";

interface ToastItem {
  id: number;
  type: "success" | "error" | "warn";
  msg: string;
}

const ROWS_PER_PAGE = 10;

function getPageRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set(
    [1, total, current, current - 1, current + 1].filter(
      (p) => p >= 1 && p <= total
    )
  );
  const sorted = Array.from(set).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let prev: number | null = null;
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

export function AccountManagementView({
  config,
}: {
  config: AccountManagementConfig;
}) {
  const { data, error, isLoading, mutate } = useSWR<AccountsApiResponse>(
    `/api/admin/data?resource=${config.resource}`,
    swrPrivateConfig
  );

  const { data: sessionData } = useSWR<SessionApiResponse>(
    "/api/auth/session",
    swrPrivateConfig
  );
  const currentUserId = sessionData?.user?.id ?? null;

  // Search (300ms debounced), filter, sort, pagination
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  // Modal & action state
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedAccountRow | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    variant: "delete" | "deactivate" | "reactivate";
    row: ManagedAccountRow;
  } | null>(null);
  const [viewUser, setViewUser] = useState<ManagedAccountRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const pushToast = useCallback(
    (type: "success" | "error" | "warn", msg: string) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, type, msg }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3800);
    },
    []
  );

  const restoreFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      lastTriggerRef.current?.focus();
    });
  }, []);

  const rows = data?.rows ?? [];

  // Stats matching legacy computation
  const stats = useMemo(() => {
    let active = 0;
    let offline = 0;
    let locked = 0;
    let deactivated = 0;
    for (const r of rows) {
      if (config.showDeactivatedStat && !r.is_active) {
        deactivated++;
        continue;
      }
      if (r.status === "active") active++;
      else offline++;
      if (r.is_locked) locked++;
    }
    return { total: rows.length, active, offline, locked, deactivated };
  }, [rows, config.showDeactivatedStat]);

  // Filter + sort
  const processedRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      const haystack = `${r.fullname} ${r.email} ${r.username ?? ""}`.toLowerCase();
      const matchSearch = !debouncedSearch || haystack.includes(debouncedSearch);
      let matchFilter = true;
      if (config.showFilterTabs) {
        if (filter === "active") matchFilter = Boolean(r.is_active);
        if (filter === "deactivated") matchFilter = !r.is_active;
        if (filter === "locked") matchFilter = Boolean(r.is_locked);
      }
      return matchSearch && matchFilter;
    });

    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.fullname.localeCompare(b.fullname);
      } else if (sortKey === "registered") {
        cmp =
          (a.created_at ? Date.parse(a.created_at) : 0) -
          (b.created_at ? Date.parse(b.created_at) : 0);
      } else if (sortKey === "attempts") {
        cmp = (a.failed_attempts || 0) - (b.failed_attempts || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, debouncedSearch, filter, config.showFilterTabs, sortKey, sortDir]);

  const totalPages = config.enablePagination
    ? Math.max(1, Math.ceil(processedRows.length / ROWS_PER_PAGE))
    : 1;
  const safePage = Math.min(page, totalPages);

  const visibleRows = config.enablePagination
    ? processedRows.slice(
        (safePage - 1) * ROWS_PER_PAGE,
        safePage * ROWS_PER_PAGE
      )
    : processedRows;

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir("asc");
    }
  };

  const getAriaSort = (key: SortKey): "ascending" | "descending" | "none" => {
    if (sortKey !== key) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  };

  /* ── Mutations (existing Next.js /api/admin/data endpoints) ── */
  const handleCreateAccount = async (values: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
  }): Promise<boolean> => {
    setModalSubmitting(true);
    setAddError(null);
    try {
      await apiMutate("/api/admin/data", {
        method: "POST",
        body: {
          resource: config.resource,
          action: "create",
          payload: {
            ...values,
            role: config.addRole,
          },
        },
      });
      await mutate();
      pushToast(
        "success",
        `${config.addRole === "admin" ? "Admin" : "Librarian"} account created`
      );
      restoreFocus();
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create account.";
      setAddError(msg);
      return false;
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleUnlock = async (row: ManagedAccountRow) => {
    setBusyId(row.id);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: config.resource,
          action: "unlock",
          id: row.id,
          payload: {},
        },
      });
      await mutate();
      pushToast("success", "Account unlocked");
    } catch (err) {
      pushToast(
        "error",
        err instanceof Error ? err.message : "Failed to unlock account."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleResetPassword = async (
    userId: number,
    newPassword: string
  ): Promise<boolean> => {
    setModalSubmitting(true);
    setResetError(null);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: config.resource,
          action: "reset_password",
          id: userId,
          payload: { new_password: newPassword },
        },
      });
      await mutate();
      pushToast("success", "Password reset successfully");
      restoreFocus();
      return true;
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed.");
      return false;
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;
    const { variant, row } = confirmState;
    setModalSubmitting(true);
    try {
      if (variant === "delete") {
        await apiMutate("/api/admin/data", {
          method: "DELETE",
          body: {
            resource: config.resource,
            action: "delete",
            id: row.id,
          },
        });
        await mutate();
        pushToast("success", config.deleteSuccessToast);
      } else {
        const nextActive = variant === "reactivate";
        await apiMutate("/api/admin/data", {
          method: "PUT",
          body: {
            resource: config.resource,
            action: "toggle_active",
            id: row.id,
            payload: { is_active: nextActive },
          },
        });
        await mutate();
        pushToast(
          nextActive ? "success" : "warn",
          nextActive ? "Account reactivated" : "Account deactivated"
        );
      }
      setConfirmState(null);
      restoreFocus();
    } catch (err) {
      pushToast(
        "error",
        err instanceof Error ? err.message : "Operation failed."
      );
    } finally {
      setModalSubmitting(false);
    }
  };

  const HeaderIcon = config.resource === "users" ? Users : IdCard;
  const colSpan =
    6 +
    (config.showUsernameColumn ? 1 : 0) +
    (config.showLastSeenColumn ? 1 : 0) +
    (config.showAccountStatusColumn ? 1 : 0);

  return (
    <StaffShell title={config.topbarTitle}>
      <div className="admin-accounts-page mx-auto max-w-[1500px] overflow-x-clip pb-8">
        {/* Page Header */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              className="flex items-center gap-2.5 text-[1.75rem] font-bold tracking-[-0.03em]"
              style={{ color: "var(--acct-text-primary)" }}
            >
              <HeaderIcon
                className="h-7 w-7 shrink-0"
                style={{ color: "var(--accent)" }}
                aria-hidden="true"
              />
              <span>
                {config.headingPrefix}{" "}
                <span style={{ color: "var(--accent)" }}>
                  {config.headingAccent}
                </span>
              </span>
            </h1>
            <p className="mt-1 text-[0.88rem]" style={{ color: "var(--tl)" }}>
              {config.subtitle}
            </p>
          </div>

          {config.enableAddModal && config.addRole && (
            <button
              type="button"
              onClick={(e) => {
                lastTriggerRef.current = e.currentTarget;
                setAddError(null);
                setAddOpen(true);
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] px-5 py-2.5 text-[0.88rem] font-bold transition hover:-translate-y-[1px] cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor:
                  config.addRole === "admin" ? "var(--warn)" : "var(--accent)",
                color: "#0d1a24",
              }}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {config.addRole === "admin" ? "Add Admin" : "Add Librarian"}
              </span>
            </button>
          )}
        </div>

        {/* Stat Cards */}
        <div
          className={`mb-6 grid grid-cols-2 gap-3.5 ${
            config.showDeactivatedStat ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-4"
          }`}
        >
          {[
            {
              label: config.totalStatLabel,
              val: stats.total,
              icon: Users,
              bg: "rgba(var(--accent-rgb), 0.18)",
              color: "var(--accent)",
            },
            {
              label: "Active",
              val: stats.active,
              icon: Circle,
              bg: "rgba(var(--accent2-rgb), 0.18)",
              color: "var(--accent2)",
            },
            {
              label: "Offline",
              val: stats.offline,
              icon: Moon,
              bg: "rgba(var(--warn-rgb), 0.18)",
              color: "var(--warn)",
            },
            {
              label: "Locked",
              val: stats.locked,
              icon: Lock,
              bg: "rgba(var(--danger-rgb), 0.18)",
              color: "var(--danger)",
            },
            ...(config.showDeactivatedStat
              ? [
                  {
                    label: "Deactivated",
                    val: stats.deactivated,
                    icon: PauseCircle,
                    bg: "var(--acct-pill-bg)",
                    color: "var(--acct-text-muted)",
                  },
                ]
              : []),
          ].map(({ label, val, icon: Icon, bg, color }) => (
            <div
              key={label}
              className="flex items-center gap-3.5 rounded-[14px] px-[18px] py-4 transition hover:-translate-y-0.5"
              style={{
                backgroundColor: "var(--acct-card-bg)",
                border: "1px solid var(--acct-border)",
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
                style={{ backgroundColor: bg, color }}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="mb-0.5 text-[0.73rem]" style={{ color: "var(--tl)" }}>
                  {label}
                </div>
                {isLoading ? (
                  <div
                    className="h-5 w-10 animate-pulse rounded"
                    style={{ backgroundColor: "var(--acct-pill-bg)" }}
                  />
                ) : (
                  <div
                    className="acct-tabular text-[1.4rem] font-bold leading-none"
                    style={{ color: "var(--acct-text-primary)" }}
                  >
                    {val.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Unified Browse-Catalog Command Bar: 48px Search + Status Filter Pills + Sort + Counter */}
        <div className="mb-5 space-y-2.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="group relative flex-1">
              <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-accent/20 via-accent2/10 to-accent/20 opacity-0 blur transition duration-300 group-focus-within:opacity-100" />
              <div className="relative flex h-[48px] items-center rounded-2xl border border-white/12 bg-bg1/90 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-200 focus-within:border-accent/50 focus-within:bg-bg1">
                <Search
                  className="h-4.5 w-4.5 shrink-0 text-accent/80 transition-transform duration-200 group-focus-within:scale-110"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  aria-label={config.searchPlaceholder}
                  placeholder={config.searchPlaceholder}
                  className="w-full bg-transparent py-2 pl-3 pr-3 text-[0.9rem] text-white placeholder:text-white/38 focus:outline-none"
                />
                {searchInput ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearchInput("")}
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
              {config.showFilterTabs && (
                <div
                  role="group"
                  aria-label="Filter users by status"
                  className="flex flex-wrap items-center gap-2"
                >
                  {(
                    [
                      { id: "all", label: "All Accounts", tone: "accent" },
                      { id: "active", label: "Active", tone: "accent2" },
                      { id: "deactivated", label: "Deactivated", tone: "warn" },
                      { id: "locked", label: "Locked", tone: "danger" },
                    ] as const
                  ).map((tab) => {
                    const active = filter === tab.id;
                    const toneCls =
                      tab.tone === "warn"
                        ? "border-warn/45 bg-warn/15 text-warn"
                        : tab.tone === "danger"
                          ? "border-danger/45 bg-danger/15 text-danger"
                          : tab.tone === "accent2"
                            ? "border-accent2/45 bg-accent2/15 text-accent2"
                            : "border-accent/45 bg-accent/15 text-accent";

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setFilter(tab.id);
                          setPage(1);
                        }}
                        className={`inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition-all ${
                          active
                            ? toneCls
                            : "border-white/12 bg-bg1/85 text-white/75 hover:border-white/22 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => toggleSort(sortKey === "name" ? "registered" : "name")}
                className="inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-bg1/85 px-4 text-xs font-semibold text-white/80 transition hover:border-white/22 hover:bg-white/8 hover:text-white"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-accent/80" aria-hidden="true" />
                <span className="text-white/45">Sort:</span>
                <span className="capitalize text-white">
                  {sortKey ?? "Default"} ({sortDir === "asc" ? "↑" : "↓"})
                </span>
              </button>

              <div className="ml-auto flex h-[48px] items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 text-xs text-tl lg:ml-0">
                <span className="acct-tabular whitespace-nowrap">
                  <strong className="font-semibold text-white">{processedRows.length}</strong> /{" "}
                  {rows.length}{" "}
                  {processedRows.length === 1 ? config.singularLabel : config.pluralLabel}
                </span>
              </div>
            </div>
          </div>

          {(debouncedSearch || filter !== "all") && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-[0.72rem] font-semibold uppercase tracking-wider text-white/40">
                Active filters:
              </span>
              {filter !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setPage(1);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/12 px-2.5 py-1 text-xs font-medium capitalize text-accent transition hover:bg-accent/20"
                >
                  <span>Status: {filter}</span>
                  <X className="h-3 w-3" />
                </button>
              )}
              {debouncedSearch && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-2.5 py-1 text-xs font-medium text-white/85 transition hover:bg-white/14"
                >
                  <span>Query: &ldquo;{debouncedSearch}&rdquo;</span>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error State */}
        {error && !isLoading && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] px-5 py-4"
            style={{
              backgroundColor: "rgba(var(--danger-rgb), 0.1)",
              border: "1px solid rgba(var(--danger-rgb), 0.3)",
              color: "var(--danger)",
            }}
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Failed to load {config.pluralLabel}.
            </span>
            <button
              type="button"
              onClick={() => void mutate()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: "var(--acct-pill-bg)",
                border: "1px solid var(--acct-pill-border)",
                color: "var(--acct-text-primary)",
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {/* Table Card (Desktop / Tablet >= 640px) + Stacked Cards (< 640px) */}
        <div
          className="overflow-hidden rounded-[18px]"
          style={{
            backgroundColor: "var(--acct-card-bg)",
            border: "1px solid var(--acct-border)",
          }}
        >
          {/* Desktop/Tablet Table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[920px] border-collapse">
              <thead>
                <tr style={{ backgroundColor: "var(--acct-thead-bg)" }}>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-left text-[0.75rem] font-bold uppercase tracking-[0.07em]"
                    style={{ color: "var(--accent)" }}
                  >
                    #
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-left text-[0.75rem] font-bold uppercase tracking-[0.07em]"
                    style={{ color: "var(--accent)" }}
                  >
                    Role
                  </th>
                  <th
                    scope="col"
                    aria-sort={getAriaSort("name")}
                    className="whitespace-nowrap px-4 py-3 text-left text-[0.75rem] font-bold uppercase tracking-[0.07em]"
                    style={{ color: "var(--accent)" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="inline-flex min-h-[32px] items-center gap-1 uppercase cursor-pointer"
                    >
                      Name
                      <ArrowUpDown className="h-3 w-3 opacity-70" aria-hidden="true" />
                    </button>
                  </th>
                  {config.showUsernameColumn && (
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 text-left text-[0.75rem] font-bold uppercase tracking-[0.07em]"
                      style={{ color: "var(--accent)" }}
                    >
                      Username
                    </th>
                  )}
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-left text-[0.75rem] font-bold uppercase tracking-[0.07em]"
                    style={{ color: "var(--accent)" }}
                  >
                    {config.showAccountStatusColumn ? "Online Status" : "Status"}
                  </th>
                  {config.showAccountStatusColumn && (
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 text-left text-[0.75rem] font-bold uppercase tracking-[0.07em]"
                      style={{ color: "var(--accent)" }}
                    >
                      Account Status
                    </th>
                  )}
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-left text-[0.75rem] font-bold uppercase tracking-[0.07em]"
                    style={{ color: "var(--accent)" }}
                  >
                    Lock Status
                  </th>
                  <th
                    scope="col"
                    aria-sort={getAriaSort("attempts")}
                    className="whitespace-nowrap px-4 py-3 text-left text-[0.75rem] font-bold uppercase tracking-[0.07em]"
                    style={{ color: "var(--accent)" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("attempts")}
                      className="inline-flex min-h-[32px] items-center gap-1 uppercase cursor-pointer"
                    >
                      Failed Attempts
                      <ArrowUpDown className="h-3 w-3 opacity-70" aria-hidden="true" />
                    </button>
                  </th>
                  {config.showLastSeenColumn && (
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 text-left text-[0.75rem] font-bold uppercase tracking-[0.07em]"
                      style={{ color: "var(--accent)" }}
                    >
                      Last Seen
                    </th>
                  )}
                  <th
                    scope="col"
                    aria-sort={getAriaSort("registered")}
                    className="whitespace-nowrap px-4 py-3 text-left text-[0.75rem] font-bold uppercase tracking-[0.07em]"
                    style={{ color: "var(--accent)" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort("registered")}
                      className="inline-flex min-h-[32px] items-center gap-1 uppercase cursor-pointer"
                    >
                      Registered
                      <ArrowUpDown className="h-3 w-3 opacity-70" aria-hidden="true" />
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-left text-[0.75rem] font-bold uppercase tracking-[0.07em]"
                    style={{ color: "var(--accent)" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: "1px solid var(--acct-border-subtle)" }}
                    >
                      <td colSpan={colSpan} className="px-4 py-3">
                        <div
                          className="h-8 w-full animate-pulse rounded-lg"
                          style={{ backgroundColor: "var(--acct-pill-bg)" }}
                        />
                      </td>
                    </tr>
                  ))
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={colSpan}
                      className="px-5 py-14 text-center text-[0.88rem]"
                      style={{ color: "var(--acct-text-muted)" }}
                    >
                      <UserX
                        className="mx-auto mb-2.5 h-10 w-10 opacity-35"
                        aria-hidden="true"
                      />
                      {debouncedSearch || filter !== "all"
                        ? `No matching ${config.pluralLabel} found.`
                        : config.emptyText}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, idx) => {
                    const rowNum = config.enablePagination
                      ? (safePage - 1) * ROWS_PER_PAGE + idx + 1
                      : idx + 1;
                    const isSelf = currentUserId !== null && row.id === currentUserId;
                    const isOnline = row.status === "active";
                    const attempts = row.failed_attempts || 0;

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors hover:bg-white/[0.04] ${
                          !row.is_active && config.showAccountStatusColumn
                            ? "opacity-60"
                            : ""
                        }`}
                        style={{ borderBottom: "1px solid var(--acct-border-subtle)" }}
                      >
                        <td
                          className="acct-tabular px-4 py-3 text-[0.73rem]"
                          style={{ color: "var(--acct-text-faint)" }}
                        >
                          {rowNum}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[0.72rem] font-bold capitalize"
                            style={{
                              backgroundColor: "rgba(var(--accent-rgb), 0.12)",
                              border: "1px solid rgba(var(--accent-rgb), 0.25)",
                              color: "var(--accent)",
                            }}
                          >
                            {row.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="text-[0.88rem] font-semibold"
                            style={{ color: "var(--acct-text-primary)" }}
                          >
                            {row.fullname}
                            {isSelf && (
                              <span
                                className="ml-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-bold"
                                style={{
                                  backgroundColor: "rgba(var(--accent2-rgb), 0.15)",
                                  color: "var(--accent2)",
                                }}
                              >
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        {config.showUsernameColumn && (
                          <td
                            className="px-4 py-3 font-mono text-[0.77rem]"
                            style={{ color: "var(--acct-text-muted)" }}
                          >
                            {row.email || "—"}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[0.72rem] font-bold"
                            style={
                              isOnline
                                ? {
                                    backgroundColor: "rgba(var(--accent2-rgb), 0.14)",
                                    border: "1px solid rgba(var(--accent2-rgb), 0.3)",
                                    color: "var(--accent2)",
                                  }
                                : {
                                    backgroundColor: "var(--acct-pill-bg)",
                                    border: "1px solid var(--acct-pill-border)",
                                    color: "var(--acct-text-muted)",
                                  }
                            }
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${
                                isOnline ? "acct-pulse-dot" : ""
                              }`}
                              aria-hidden="true"
                            />
                            {isOnline ? "Active" : "Offline"}
                          </span>
                        </td>
                        {config.showAccountStatusColumn && (
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[0.72rem] font-bold"
                              style={
                                row.is_active
                                  ? {
                                      backgroundColor: "rgba(var(--accent2-rgb), 0.12)",
                                      border: "1px solid rgba(var(--accent2-rgb), 0.25)",
                                      color: "var(--accent2)",
                                    }
                                  : {
                                      backgroundColor: "rgba(var(--danger-rgb), 0.12)",
                                      border: "1px solid rgba(var(--danger-rgb), 0.25)",
                                      color: "var(--danger)",
                                    }
                              }
                            >
                              {row.is_active ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                  Enabled
                                </>
                              ) : (
                                <>
                                  <PauseCircle className="h-3 w-3" aria-hidden="true" />
                                  Deactivated
                                </>
                              )}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          {row.is_locked ? (
                            <div>
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[0.72rem] font-bold"
                                style={{
                                  backgroundColor: "rgba(var(--danger-rgb), 0.14)",
                                  border: "1px solid rgba(var(--danger-rgb), 0.3)",
                                  color: "var(--danger)",
                                }}
                              >
                                <Lock className="h-3 w-3" aria-hidden="true" />
                                Locked
                              </span>
                              {row.lock_until && (
                                <div
                                  className="mt-1 text-[0.7rem]"
                                  style={{ color: "var(--acct-text-faint)" }}
                                >
                                  Until {formatTimeOnly(row.lock_until)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[0.72rem] font-bold"
                              style={{
                                backgroundColor: "rgba(var(--accent2-rgb), 0.14)",
                                border: "1px solid rgba(var(--accent2-rgb), 0.3)",
                                color: "var(--accent2)",
                              }}
                            >
                              <Unlock className="h-3 w-3" aria-hidden="true" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="acct-tabular text-[0.82rem] font-bold"
                            style={{
                              color: attempts >= 3 ? "var(--danger)" : "var(--accent2)",
                            }}
                          >
                            {attempts}/5
                          </span>
                        </td>
                        {config.showLastSeenColumn && (
                          <td
                            className="whitespace-nowrap px-4 py-3 text-[0.75rem]"
                            style={{ color: "var(--acct-text-secondary)" }}
                          >
                            {row.last_seen ? (
                              formatDateTime(row.last_seen)
                            ) : (
                              <span style={{ color: "var(--acct-text-faint)" }}>Never</span>
                            )}
                          </td>
                        )}
                        <td
                          className="acct-tabular whitespace-nowrap px-4 py-3 text-[0.75rem]"
                          style={{ color: "var(--acct-text-secondary)" }}
                        >
                          {formatDateOnly(row.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-nowrap items-center gap-1.5">
                            {config.enableViewDetails && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  lastTriggerRef.current = e.currentTarget;
                                  setViewUser(row);
                                }}
                                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer"
                                style={{
                                  border: "1px solid rgba(var(--accent-rgb), 0.3)",
                                  color: "var(--accent)",
                                }}
                              >
                                <IdCard className="h-3.5 w-3.5" aria-hidden="true" />
                                View
                              </button>
                            )}

                            {row.is_locked && (
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => void handleUnlock(row)}
                                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer disabled:opacity-50"
                                style={{
                                  border: "1px solid rgba(var(--accent2-rgb), 0.3)",
                                  color: "var(--accent2)",
                                }}
                              >
                                <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                                Unlock
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                lastTriggerRef.current = e.currentTarget;
                                setResetError(null);
                                setResetTarget(row);
                              }}
                              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer"
                              style={{
                                border: "1px solid rgba(var(--warn-rgb), 0.3)",
                                color: "var(--warn)",
                              }}
                            >
                              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                              Reset
                            </button>

                            {config.enableDeactivateToggle && (
                              <button
                                type="button"
                                disabled={isSelf}
                                title={
                                  isSelf
                                    ? "You cannot deactivate your own signed-in account"
                                    : row.is_active
                                    ? "Deactivate account"
                                    : "Reactivate account"
                                }
                                onClick={(e) => {
                                  lastTriggerRef.current = e.currentTarget;
                                  setConfirmState({
                                    variant: row.is_active ? "deactivate" : "reactivate",
                                    row,
                                  });
                                }}
                                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2.5 py-1.5 text-[0.78rem] font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                style={
                                  row.is_active
                                    ? {
                                        border: "1px solid rgba(var(--warn-rgb), 0.3)",
                                        color: "var(--warn)",
                                      }
                                    : {
                                        border: "1px solid rgba(var(--accent2-rgb), 0.3)",
                                        color: "var(--accent2)",
                                      }
                                }
                              >
                                {row.is_active ? (
                                  <>
                                    <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                    Reactivate
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={isSelf}
                              title={
                                isSelf
                                  ? "You cannot delete your own signed-in account"
                                  : `Delete ${row.fullname}`
                              }
                              aria-label={
                                isSelf
                                  ? `Cannot delete your own account (${row.fullname})`
                                  : `Delete ${row.fullname}`
                              }
                              onClick={(e) => {
                                lastTriggerRef.current = e.currentTarget;
                                setConfirmState({ variant: "delete", row });
                              }}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-35"
                              style={{
                                border: "1px solid rgba(var(--danger-rgb), 0.3)",
                                color: "var(--danger)",
                              }}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards (< 640px) */}
          <div className="divide-y sm:hidden" style={{ borderColor: "var(--acct-border-subtle)" }}>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div
                    className="h-24 w-full animate-pulse rounded-xl"
                    style={{ backgroundColor: "var(--acct-pill-bg)" }}
                  />
                </div>
              ))
            ) : visibleRows.length === 0 ? (
              <div
                className="px-5 py-12 text-center text-sm"
                style={{ color: "var(--acct-text-muted)" }}
              >
                {debouncedSearch || filter !== "all"
                  ? `No matching ${config.pluralLabel} found.`
                  : config.emptyText}
              </div>
            ) : (
              visibleRows.map((row) => {
                const isSelf = currentUserId !== null && row.id === currentUserId;
                const isOnline = row.status === "active";
                return (
                  <div
                    key={row.id}
                    className={`space-y-3 p-4 ${
                      !row.is_active && config.showAccountStatusColumn ? "opacity-65" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">
                          {row.fullname} {isSelf ? "(You)" : ""}
                        </div>
                        {config.showUsernameColumn && (
                          <div
                            className="truncate font-mono text-xs"
                            style={{ color: "var(--acct-text-muted)" }}
                          >
                            {row.email}
                          </div>
                        )}
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold"
                        style={
                          isOnline
                            ? {
                                backgroundColor: "rgba(var(--accent2-rgb), 0.14)",
                                color: "var(--accent2)",
                              }
                            : {
                                backgroundColor: "var(--acct-pill-bg)",
                                color: "var(--acct-text-muted)",
                              }
                        }
                      >
                        {isOnline ? "Active" : "Offline"}
                      </span>
                    </div>

                    <div
                      className="flex flex-wrap gap-2 text-xs"
                      style={{ color: "var(--acct-text-muted)" }}
                    >
                      <span>Registered: {formatDateOnly(row.created_at)}</span>
                      <span>· Attempts: {row.failed_attempts || 0}/5</span>
                      {row.is_locked && (
                        <span style={{ color: "var(--danger)" }}>· Locked</span>
                      )}
                      {config.showAccountStatusColumn && !row.is_active && (
                        <span style={{ color: "var(--warn)" }}>· Deactivated</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {config.enableViewDetails && (
                        <button
                          type="button"
                          onClick={(e) => {
                            lastTriggerRef.current = e.currentTarget;
                            setViewUser(row);
                          }}
                          className="min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                          style={{
                            border: "1px solid rgba(var(--accent-rgb), 0.3)",
                            color: "var(--accent)",
                          }}
                        >
                          View
                        </button>
                      )}
                      {row.is_locked && (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void handleUnlock(row)}
                          className="min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                          style={{
                            border: "1px solid rgba(var(--accent2-rgb), 0.3)",
                            color: "var(--accent2)",
                          }}
                        >
                          Unlock
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          lastTriggerRef.current = e.currentTarget;
                          setResetError(null);
                          setResetTarget(row);
                        }}
                        className="min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                        style={{
                          border: "1px solid rgba(var(--warn-rgb), 0.3)",
                          color: "var(--warn)",
                        }}
                      >
                        Reset
                      </button>
                      {config.enableDeactivateToggle && (
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={(e) => {
                            lastTriggerRef.current = e.currentTarget;
                            setConfirmState({
                              variant: row.is_active ? "deactivate" : "reactivate",
                              row,
                            });
                          }}
                          className="min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-40"
                          style={{
                            border: row.is_active
                              ? "1px solid rgba(var(--warn-rgb), 0.3)"
                              : "1px solid rgba(var(--accent2-rgb), 0.3)",
                            color: row.is_active ? "var(--warn)" : "var(--accent2)",
                          }}
                        >
                          {row.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isSelf}
                        aria-label={`Delete ${row.fullname}`}
                        onClick={(e) => {
                          lastTriggerRef.current = e.currentTarget;
                          setConfirmState({ variant: "delete", row });
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-lg cursor-pointer disabled:opacity-35"
                        style={{
                          border: "1px solid rgba(var(--danger-rgb), 0.3)",
                          color: "var(--danger)",
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination (Users / Members page, matching legacy 10 rows/page) */}
          {config.enablePagination && processedRows.length > ROWS_PER_PAGE && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              style={{
                borderTop: "1px solid var(--acct-border)",
                backgroundColor: "var(--acct-inner-bg)",
              }}
            >
              <div
                className="acct-tabular text-[0.78rem]"
                style={{ color: "var(--tl)" }}
              >
                Showing{" "}
                <strong style={{ color: "var(--acct-text-primary)" }}>
                  {(safePage - 1) * ROWS_PER_PAGE + 1}–
                  {Math.min(safePage * ROWS_PER_PAGE, processedRows.length)}
                </strong>{" "}
                of{" "}
                <strong style={{ color: "var(--acct-text-primary)" }}>
                  {processedRows.length}
                </strong>{" "}
                {config.pluralLabel}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-35"
                  style={{
                    backgroundColor: "var(--acct-pill-bg)",
                    border: "1px solid var(--acct-pill-border)",
                    color: "var(--acct-text-secondary)",
                  }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Prev
                </button>

                {getPageRange(safePage, totalPages).map((item, idx) =>
                  item === "…" ? (
                    <span
                      key={`e-${idx}`}
                      className="px-2 text-xs"
                      style={{ color: "var(--acct-text-faint)" }}
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      aria-current={item === safePage ? "page" : undefined}
                      onClick={() => setPage(item)}
                      className="min-h-[44px] min-w-[44px] rounded-lg px-2 text-xs font-bold cursor-pointer"
                      style={
                        item === safePage
                          ? {
                              backgroundColor: "rgba(var(--accent-rgb), 0.22)",
                              border: "1px solid rgba(var(--accent-rgb), 0.5)",
                              color: "var(--accent)",
                            }
                          : {
                              backgroundColor: "var(--acct-pill-bg)",
                              border: "1px solid var(--acct-pill-border)",
                              color: "var(--acct-text-secondary)",
                            }
                      }
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-35"
                  style={{
                    backgroundColor: "var(--acct-pill-bg)",
                    border: "1px solid var(--acct-pill-border)",
                    color: "var(--acct-text-secondary)",
                  }}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        {config.enableAddModal && config.addRole && (
          <AddAccountModal
            open={addOpen}
            role={config.addRole}
            submitting={modalSubmitting}
            error={addError}
            onClose={() => {
              setAddOpen(false);
              restoreFocus();
            }}
            onSubmit={handleCreateAccount}
          />
        )}

        <ResetPasswordModal
          open={resetTarget !== null}
          account={resetTarget}
          submitting={modalSubmitting}
          error={resetError}
          onClose={() => {
            setResetTarget(null);
            restoreFocus();
          }}
          onSubmit={handleResetPassword}
        />

        <ConfirmActionModal
          open={confirmState !== null}
          variant={confirmState?.variant ?? "delete"}
          title={
            confirmState?.variant === "deactivate"
              ? "Deactivate Account"
              : confirmState?.variant === "reactivate"
              ? "Reactivate Account"
              : "Confirm Delete"
          }
          leadText={
            confirmState?.variant === "deactivate"
              ? "Deactivate"
              : confirmState?.variant === "reactivate"
              ? "Reactivate"
              : config.deletePromptPrefix
          }
          personName={confirmState?.row.fullname ?? ""}
          subtext={
            confirmState?.variant === "deactivate"
              ? "The user will be logged out and blocked from logging in. You can reactivate them at any time."
              : confirmState?.variant === "reactivate"
              ? "The user will be able to log in and use the library again."
              : config.deleteSubtext
          }
          confirmLabel={
            confirmState?.variant === "deactivate"
              ? "Deactivate"
              : confirmState?.variant === "reactivate"
              ? "Reactivate"
              : "Delete"
          }
          submitting={modalSubmitting}
          onCancel={() => {
            setConfirmState(null);
            restoreFocus();
          }}
          onConfirm={handleConfirmAction}
        />

        {config.enableViewDetails && (
          <UserDetailsModal
            open={viewUser !== null}
            user={viewUser}
            onClose={() => {
              setViewUser(null);
              restoreFocus();
            }}
          />
        )}

        {/* Toast Notifications */}
        {toasts.length > 0 && (
          <div
            aria-live="polite"
            className="fixed bottom-[22px] right-[22px] z-[9999] flex max-w-[340px] flex-col gap-2"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2.5 rounded-[11px] px-4 py-3 text-[0.84rem] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                style={{
                  backgroundColor: "var(--acct-toast-bg)",
                  border: `1px solid ${
                    t.type === "success"
                      ? "rgba(var(--accent2-rgb), 0.4)"
                      : t.type === "warn"
                      ? "rgba(var(--warn-rgb), 0.4)"
                      : "rgba(var(--danger-rgb), 0.4)"
                  }`,
                  color: "var(--acct-text-primary)",
                }}
              >
                {t.type === "success" ? (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--accent2)" }}
                    aria-hidden="true"
                  />
                ) : t.type === "warn" ? (
                  <PauseCircle
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--warn)" }}
                    aria-hidden="true"
                  />
                ) : (
                  <AlertCircle
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--danger)" }}
                    aria-hidden="true"
                  />
                )}
                <span>{t.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </StaffShell>
  );
}
