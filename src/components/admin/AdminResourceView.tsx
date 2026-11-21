"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Database,
  Edit3,
  Eye,
  KeyRound,
  LockOpen,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  UserX,
  X,
  XCircle,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { Button } from "@/components/ui/button";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { AdminActionModals, type AdminModalState } from "@/components/admin/AdminActionModals";
import { apiMutate, swrPrivateConfig } from "@/lib/api";

export interface ColumnDef {
  key: string;
  label: string;
  mono?: boolean;
}

interface AdminResourceViewProps {
  title: string;
  accentWord: string;
  subtitle: string;
  resource: string;
  columns: ColumnDef[];
  role?: "admin" | "librarian";
}

const CREATE_BUTTON_LABELS: Record<string, string> = {
  books: "Add Book",
  users: "Add User",
  librarians: "Add Librarian",
  admins: "Add Admin",
  library_cards: "Issue Library Card",
  returns: "Record Return",
  events: "Create Event",
  announcements: "Post Notice",
};

export function AdminResourceView({
  title,
  accentWord,
  subtitle,
  resource,
  columns,
  role = "admin",
}: AdminResourceViewProps) {
  const isLibrarian = role === "librarian";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [modal, setModal] = useState<AdminModalState>({ type: "none" });
  const [actionBanner, setActionBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const toggleSort = (colKey: string) => {
    if (sortCol === colKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colKey);
      setSortDir(
        colKey === "available_copies" || colKey === "damaged_copies" || colKey === "lost_copies"
          ? "desc"
          : "asc"
      );
    }
  };

  const { data, error, isLoading, mutate } = useSWR<{ rows?: Record<string, unknown>[] }>(
    `/api/admin/data?resource=${encodeURIComponent(resource)}`,
    swrPrivateConfig
  );

  const rows = useMemo(() => {
    const raw = data?.rows ?? [];
    if (isLibrarian && resource === "account_requests") {
      return raw.filter((row) => String(row.request_type) === "renew");
    }
    return raw;
  }, [data?.rows, isLibrarian, resource]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (resource === "account_requests" && statusFilter !== "all") {
        if (String(row.status) !== statusFilter) return false;
      }
      if ((resource === "inventory" || resource === "books") && statusFilter !== "all") {
        const avail = Number(row.available_copies ?? 0);
        const dmg = Number(row.damaged_copies ?? 0);
        const lost = Number(row.lost_copies ?? 0);
        if (statusFilter === "available" && avail <= 0) return false;
        if (statusFilter === "damaged" && dmg <= 0) return false;
        if (statusFilter === "lost" && lost <= 0) return false;
        if (statusFilter === "out_of_stock" && avail > 0) return false;
      }
      if (
        (resource === "users" || resource === "librarians" || resource === "admins") &&
        statusFilter !== "all"
      ) {
        if (statusFilter === "pending" && Boolean(row.is_approved)) return false;
        if (statusFilter === "locked" && !Boolean(row.is_locked)) return false;
        if (statusFilter === "inactive" && Boolean(row.is_active)) return false;
      }
      if (!q) return true;
      return Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q));
    });

    if (!sortCol) return list;

    return [...list].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const aNum = Number(av);
      const bNum = Number(bv);
      let cmp = 0;
      if (
        av !== null &&
        bv !== null &&
        av !== "" &&
        bv !== "" &&
        !Number.isNaN(aNum) &&
        !Number.isNaN(bNum)
      ) {
        cmp = aNum - bNum;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, resource, statusFilter, sortCol, sortDir]);

  const runQuickAction = async (
    method: "POST" | "PUT" | "DELETE",
    action: string,
    id: number,
    payload: Record<string, unknown>,
    successMsg: string
  ) => {
    setActionBanner(null);
    try {
      await apiMutate("/api/admin/data", {
        method,
        body: { resource, action, id, payload },
      });
      setActionBanner({ type: "ok", text: successMsg });
      await mutate();
    } catch (err) {
      setActionBanner({
        type: "err",
        text: err instanceof Error ? err.message : "Action failed.",
      });
    }
  };

  const formatCell = (colKey: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") {
      return (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${
            value
              ? "border border-accent2/30 bg-accent2/15 text-accent2"
              : "border border-white/12 bg-white/6 text-white/55"
          }`}
        >
          {value ? "Yes" : "No"}
        </span>
      );
    }
    const str = String(value);
    if (str.startsWith("gAAAAAB")) {
      return (
        <LibraryTooltip label="Fernet ciphertext (add ENCRYPTION_KEY/PII_ENCRYPTION_KEY/EMAIL_ENCRYPTION_KEY in .env.local to decrypt)">
          <span className="inline-flex rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-[0.7rem] text-accent">
            [Encrypted]
          </span>
        </LibraryTooltip>
      );
    }
    if (colKey === "status" || colKey === "condition_status") {
      const low = str.toLowerCase();
      const tone =
        low === "approved" || low === "active" || low === "available" || low === "all good"
          ? "border-accent2/30 bg-accent2/15 text-accent2"
          : low === "pending" || low === "low stock" || low.includes("damaged")
            ? "border-warn/35 bg-warn/15 text-warn"
            : low === "rejected" || low === "out of stock" || low.includes("lost")
              ? "border-danger/30 bg-danger/15 text-danger"
              : "border-white/12 bg-white/8 text-tl/80";
      return (
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold capitalize ${tone}`}>
          {str}
        </span>
      );
    }
    if (colKey === "damaged_copies") {
      const num = Number(str);
      return (
        <span
          className={`inline-flex rounded-md px-2 py-0.5 font-mono text-[0.72rem] font-bold ${
            num > 0
              ? "border border-warn/35 bg-warn/15 text-warn"
              : "text-white/45"
          }`}
        >
          {num}
        </span>
      );
    }
    if (colKey === "available_copies") {
      const num = Number(str);
      return (
        <span
          className={`inline-flex rounded-md px-2 py-0.5 font-mono text-[0.72rem] font-bold ${
            num > 0
              ? "border border-accent2/30 bg-accent2/12 text-accent2"
              : "border border-danger/30 bg-danger/12 text-danger"
          }`}
        >
          {num}
        </span>
      );
    }
    if (
      (colKey === "created_at" || colKey === "last_seen" || colKey === "reviewed_at") &&
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
    return str.length > 52 ? `${str.slice(0, 52)}…` : str;
  };

  const createLabel =
    isLibrarian && (resource === "users" || resource === "librarians" || resource === "admins")
      ? undefined
      : CREATE_BUTTON_LABELS[resource];

  return (
    <StaffShell title={`${title} ${accentWord}`.trim()} role={role}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-white">
            {title} <span className="text-accent">{accentWord}</span>
          </h1>
          <p className="mt-1 text-[0.84rem] text-tl">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {createLabel && (
            <Button
              variant="accent"
              size="sm"
              onClick={() => setModal({ type: "create" })}
            >
              <Plus className="h-4 w-4" />
              {createLabel}
            </Button>
          )}
          <LibraryTooltip label="Refresh from Supabase">
            <Button variant="secondary" size="sm" onClick={() => mutate()}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </LibraryTooltip>
        </div>
      </div>

      {actionBanner && (
        <div
          className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs ${
            actionBanner.type === "ok"
              ? "border-accent2/30 bg-accent2/12 text-accent2"
              : "border-danger/30 bg-danger/12 text-danger"
          }`}
        >
          <span>{actionBanner.text}</span>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-card-glass p-3.5 backdrop-blur-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Filter ${rows.length} record(s)...`}
            className="w-full rounded-xl border border-white/10 bg-bg1/75 py-2 pl-9 pr-9 text-sm text-white placeholder:text-tl/45 focus:border-accent/50 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear filter"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {resource === "account_requests" && (
          <div className="flex items-center gap-1.5">
            {["all", "pending", "approved", "rejected"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg border px-2.5 py-1 text-[0.7rem] font-semibold capitalize transition cursor-pointer ${
                  statusFilter === st
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-white/10 bg-white/5 text-tl/70 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        {(resource === "inventory" || resource === "books") && (
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "All Conditions" },
              { id: "available", label: "Available Copies (>0)" },
              { id: "damaged", label: "Has Damaged Copies" },
              { id: "lost", label: "Has Lost Copies" },
              { id: "out_of_stock", label: "Out of Stock" },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setStatusFilter(pill.id);
                  if (pill.id === "damaged") {
                    setSortCol("damaged_copies");
                    setSortDir("desc");
                  } else if (pill.id === "available") {
                    setSortCol("available_copies");
                    setSortDir("desc");
                  }
                }}
                className={`rounded-lg border px-2.5 py-1 text-[0.7rem] font-semibold transition cursor-pointer ${
                  statusFilter === pill.id
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-white/10 bg-white/5 text-tl/70 hover:text-white"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}

        {(resource === "users" || resource === "librarians" || resource === "admins") && (
          <div className="flex items-center gap-1.5">
            {[
              { id: "all", label: "All" },
              { id: "pending", label: "Pending" },
              { id: "locked", label: "Locked" },
              { id: "inactive", label: "Inactive" },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id)}
                className={`rounded-lg border px-2.5 py-1 text-[0.7rem] font-semibold transition cursor-pointer ${
                  statusFilter === pill.id
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-white/10 bg-white/5 text-tl/70 hover:text-white"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}

        <span className="font-mono text-xs text-tl/70">
          Showing {filtered.length} / {rows.length}
        </span>
      </div>

      {/* Table */}
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/25 bg-danger/10 p-5 text-sm text-danger">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error.message || "Unable to load records from Supabase."}</span>
          </div>
          <Button variant="accent" size="sm" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2.5 rounded-2xl border border-white/8 bg-card-glass p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-white/6" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-card-glass p-12 text-center">
          <Database className="mx-auto mb-3 h-9 w-9 text-accent/45" />
          <h3 className="text-sm font-bold text-white">No records found</h3>
          <p className="mt-1 text-xs text-tl/70">
            This Supabase table currently has no matching entries.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-glass backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/4 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-accent">
                  {columns.map((col) => {
                    const isSorted = sortCol === col.key;
                    return (
                      <th key={col.key} className="px-4 py-3 font-semibold whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className="inline-flex cursor-pointer items-center gap-1 text-left uppercase tracking-[0.08em] transition hover:text-white"
                        >
                          <span>{col.label}</span>
                          {isSorted ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-accent2" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-accent2" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-35" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {filtered.map((row, idx) => {
                  const rowId = Number(row.id);
                  return (
                    <tr
                      key={String(row.id ?? idx)}
                      className="transition-colors hover:bg-white/5"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 text-tl ${col.mono ? "font-mono text-[0.75rem]" : ""}`}
                        >
                          {formatCell(col.key, row[col.key])}
                        </td>
                      ))}

                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {/* Always available: Inspect full record */}
                          <LibraryTooltip label="Inspect Details">
                            <button
                              type="button"
                              onClick={() => setModal({ type: "inspect", row })}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-tl/80 transition hover:border-accent/40 hover:text-accent cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </LibraryTooltip>

                          {/* Account Requests: Approve / Reject / Delete */}
                          {resource === "account_requests" && row.status === "pending" && (
                            <>
                              <LibraryTooltip label="Approve Request">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setModal({ type: "review", row, decision: "approve" })
                                  }
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent2/30 bg-accent2/12 text-accent2 transition hover:bg-accent2/25 cursor-pointer"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </button>
                              </LibraryTooltip>
                              <LibraryTooltip label="Reject Request">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setModal({ type: "review", row, decision: "reject" })
                                  }
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-danger/30 bg-danger/12 text-danger transition hover:bg-danger/25 cursor-pointer"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              </LibraryTooltip>
                            </>
                          )}
                          {resource === "account_requests" && row.status !== "pending" && (
                            <LibraryTooltip label="Delete Processed Request">
                              <button
                                type="button"
                                onClick={() => setModal({ type: "delete", row })}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-danger/25 bg-danger/10 text-danger transition hover:bg-danger/20 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </LibraryTooltip>
                          )}

                          {/* Users / Librarians / Admins Actions (admin only) */}
                          {!isLibrarian &&
                            (resource === "users" ||
                              resource === "librarians" ||
                              resource === "admins") && (
                            <>
                              {!row.is_approved && (
                                <LibraryTooltip label="Approve Account">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      runQuickAction(
                                        "PUT",
                                        "approve",
                                        rowId,
                                        {},
                                        `Account #${rowId} approved.`
                                      )
                                    }
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent2/30 bg-accent2/12 text-accent2 transition hover:bg-accent2/25 cursor-pointer"
                                  >
                                    <UserCheck className="h-3.5 w-3.5" />
                                  </button>
                                </LibraryTooltip>
                              )}
                              {Boolean(row.is_locked) && (
                                <LibraryTooltip label="Unlock Account">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      runQuickAction(
                                        "PUT",
                                        "unlock",
                                        rowId,
                                        {},
                                        `Account #${rowId} unlocked.`
                                      )
                                    }
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-warn/30 bg-warn/12 text-warn transition hover:bg-warn/25 cursor-pointer"
                                  >
                                    <LockOpen className="h-3.5 w-3.5" />
                                  </button>
                                </LibraryTooltip>
                              )}
                              <LibraryTooltip
                                label={row.is_active ? "Deactivate Account" : "Activate Account"}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    runQuickAction(
                                      "PUT",
                                      "toggle_active",
                                      rowId,
                                      { is_active: !row.is_active },
                                      `Account #${rowId} ${row.is_active ? "deactivated" : "activated"}.`
                                    )
                                  }
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-tl/80 transition hover:border-warn/40 hover:text-warn cursor-pointer"
                                >
                                  {row.is_active ? (
                                    <UserX className="h-3.5 w-3.5" />
                                  ) : (
                                    <UserCheck className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </LibraryTooltip>
                              <LibraryTooltip label="Reset Password">
                                <button
                                  type="button"
                                  onClick={() => setModal({ type: "reset_password", row })}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-tl/80 transition hover:border-accent/40 hover:text-accent cursor-pointer"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </button>
                              </LibraryTooltip>
                              <LibraryTooltip label="Delete Account">
                                <button
                                  type="button"
                                  onClick={() => setModal({ type: "delete", row })}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-danger/25 bg-danger/10 text-danger transition hover:bg-danger/20 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </LibraryTooltip>
                            </>
                          )}

                          {/* Books & Inventory Edit / Delete */}
                          {(resource === "books" ||
                            resource === "inventory" ||
                            resource === "events" ||
                            resource === "announcements") && (
                            <LibraryTooltip label="Edit Record">
                              <button
                                type="button"
                                onClick={() => setModal({ type: "edit", row })}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent transition hover:bg-accent/20 cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            </LibraryTooltip>
                          )}

                          {resource === "announcements" && (
                            <LibraryTooltip label={row.pinned ? "Unpin Notice" : "Pin Notice"}>
                              <button
                                type="button"
                                onClick={() =>
                                  runQuickAction(
                                    "PUT",
                                    "toggle_pin",
                                    rowId,
                                    { pinned: !row.pinned },
                                    `Announcement #${rowId} ${row.pinned ? "unpinned" : "pinned"}.`
                                  )
                                }
                                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition cursor-pointer ${
                                  row.pinned
                                    ? "border-gold/40 bg-gold/15 text-gold"
                                    : "border-white/10 bg-white/5 text-tl/70 hover:text-white"
                                }`}
                              >
                                <Pin className="h-3.5 w-3.5" />
                              </button>
                            </LibraryTooltip>
                          )}

                          {resource === "library_cards" && (
                            <LibraryTooltip label="Process Book Return">
                              <button
                                type="button"
                                onClick={() => setModal({ type: "return_card", row })}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent2/30 bg-accent2/12 text-accent2 transition hover:bg-accent2/25 cursor-pointer"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            </LibraryTooltip>
                          )}

                          {(resource === "books" ||
                            resource === "library_cards" ||
                            resource === "returns" ||
                            resource === "events" ||
                            resource === "announcements") && (
                            <LibraryTooltip label="Delete Record">
                              <button
                                type="button"
                                onClick={() => setModal({ type: "delete", row })}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-danger/25 bg-danger/10 text-danger transition hover:bg-danger/20 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </LibraryTooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdminActionModals
        resource={resource}
        modal={modal}
        onClose={() => setModal({ type: "none" })}
        onCompleted={() => mutate()}
      />
    </StaffShell>
  );
}
