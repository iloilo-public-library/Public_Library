"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  Edit3,
  Eye,
  Filter,
  KeyRound,
  Layers,
  LockOpen,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
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

const SEARCH_PLACEHOLDERS: Record<string, string> = {
  books: "Search titles, authors, ISBN, Book ID, call number, or subject...",
  inventory: "Search book title, Book ID, accession barcode, or shelf location...",
  account_requests: "Search applicant name, email address, or request reason...",
  library_cards: "Search borrower name, card number, phone, or borrowed title...",
  returns: "Search borrower name, returned book title, or ISBN...",
  events: "Search event title, category, location, or date...",
  announcements: "Search announcement title, message body, or author...",
  users: "Search member name, email address, phone, or school...",
  librarians: "Search librarian name, email address, or phone...",
  admins: "Search administrator name, email address, or phone...",
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
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [modal, setModal] = useState<AdminModalState>({ type: "none" });
  const [actionBanner, setActionBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [conditionMenuOpen, setConditionMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const conditionMenuRef = useRef<HTMLDivElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Cmd/Ctrl+K shortcut & outside-click dismissal matching Browse Catalog
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        setConditionMenuOpen(false);
        setCategoryMenuOpen(false);
        setSortMenuOpen(false);
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (
        conditionMenuRef.current &&
        !conditionMenuRef.current.contains(e.target as Node)
      ) {
        setConditionMenuOpen(false);
      }
      if (
        categoryMenuRef.current &&
        !categoryMenuRef.current.contains(e.target as Node)
      ) {
        setCategoryMenuOpen(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  const toggleSort = (colKey: string) => {
    if (sortCol === colKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colKey);
      setSortDir(
        colKey === "available_copies" ||
          colKey === "damaged_copies" ||
          colKey === "destroyed_copies" ||
          colKey === "lost_copies"
          ? "desc"
          : "asc"
      );
    }
  };

  const { data, error, isLoading, mutate } = useSWR<{ rows?: Record<string, unknown>[] }>(
    `/api/admin/data?resource=${encodeURIComponent(resource)}`,
    swrPrivateConfig
  );

  const handleCloseModal = useCallback(() => {
    setModal({ type: "none" });
  }, []);

  const handleModalCompleted = useCallback(() => {
    void mutate();
  }, [mutate]);

  const rows = useMemo(() => {
    const raw = data?.rows ?? [];
    if (isLibrarian && resource === "account_requests") {
      return raw.filter((row) => String(row.request_type) === "renew");
    }
    return raw;
  }, [data?.rows, isLibrarian, resource]);

  // Collection categories & counts for Books / Inventory (matches Browse Catalog)
  const { categories, categoryCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    if (resource === "books" || resource === "inventory") {
      for (const r of rows) {
        const cat = String(r.category || r.class || "").trim();
        if (cat && !cat.startsWith("gAAAAAB")) {
          counts.set(cat, (counts.get(cat) ?? 0) + 1);
        }
      }
    }
    const sorted = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b));
    return { categories: ["All", ...sorted], categoryCounts: counts };
  }, [rows, resource]);

  const checkRowMatchesStatus = useCallback(
    (row: Record<string, unknown>, filterId: string) => {
      if (filterId === "all") return true;
      if (resource === "account_requests") {
        return String(row.status) === filterId;
      }
      if (resource === "inventory" || resource === "books") {
        const avail = Number(row.available_copies ?? 0);
        const dmg = Number(row.damaged_copies ?? 0);
        const destroyed = Number(row.destroyed_copies ?? 0);
        const lost = Number(row.lost_copies ?? 0);
        const copies = Array.isArray(row.copies) ? (row.copies as Record<string, unknown>[]) : [];
        const hasDestroyedCopy =
          destroyed > 0 || copies.some((cp) => String(cp.condition) === "Destroyed");
        const hasDamagedCopy =
          dmg > 0 ||
          copies.some(
            (cp) => String(cp.condition) === "Damaged" || String(cp.condition) === "Under Repair"
          );
        const hasLostCopy =
          lost > 0 || copies.some((cp) => String(cp.condition) === "Lost");

        if (filterId === "all_good") {
          return avail > 0 && !hasDamagedCopy && !hasDestroyedCopy && !hasLostCopy;
        }
        if (filterId === "available") return avail > 0;
        if (filterId === "damaged") return hasDamagedCopy;
        if (filterId === "destroyed") return hasDestroyedCopy;
        if (filterId === "lost") return hasLostCopy;
        if (filterId === "out_of_stock") return avail <= 0;
      }
      if (resource === "users" || resource === "librarians" || resource === "admins") {
        if (filterId === "pending") return !Boolean(row.is_approved);
        if (filterId === "locked") return Boolean(row.is_locked);
        if (filterId === "inactive") return !Boolean(row.is_active);
      }
      return true;
    },
    [resource]
  );

  const statusFilterOptions = useMemo(() => {
    if (resource === "inventory" || resource === "books") {
      return [
        { id: "all", label: "All Conditions" },
        { id: "all_good", label: "All Good" },
        { id: "available", label: "Available Copies (>0)" },
        { id: "damaged", label: "Has Damaged Copies" },
        { id: "destroyed", label: "Has Destroyed Copies" },
        { id: "lost", label: "Has Lost Copies" },
        { id: "out_of_stock", label: "Out of Stock" },
      ];
    }
    if (resource === "account_requests") {
      return [
        { id: "all", label: "All Requests" },
        { id: "pending", label: "Pending Review" },
        { id: "approved", label: "Approved" },
        { id: "rejected", label: "Rejected" },
      ];
    }
    if (resource === "users" || resource === "librarians" || resource === "admins") {
      return [
        { id: "all", label: "All Accounts" },
        { id: "pending", label: "Pending Approval" },
        { id: "locked", label: "Locked Accounts" },
        { id: "inactive", label: "Deactivated" },
      ];
    }
    return [];
  }, [resource]);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const opt of statusFilterOptions) {
      map.set(
        opt.id,
        rows.filter((r) => checkRowMatchesStatus(r, opt.id)).length
      );
    }
    return map;
  }, [rows, statusFilterOptions, checkRowMatchesStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (!checkRowMatchesStatus(row, statusFilter)) return false;
      if (
        (resource === "books" || resource === "inventory") &&
        selectedCategory !== "All"
      ) {
        const cat = String(row.category || row.class || "").trim();
        if (cat !== selectedCategory) return false;
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
  }, [rows, search, resource, statusFilter, selectedCategory, sortCol, sortDir, checkRowMatchesStatus]);

  const hasActiveFilters =
    search.trim() !== "" || statusFilter !== "all" || selectedCategory !== "All";

  const activeStatusLabel =
    statusFilterOptions.find((o) => o.id === statusFilter)?.label ?? "All";

  const activeSortLabel = useMemo(() => {
    if (!sortCol) return "Default Order";
    const col = columns.find((c) => c.key === sortCol);
    return `${col?.label ?? sortCol} (${sortDir === "asc" ? "↑" : "↓"})`;
  }, [sortCol, sortDir, columns]);

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
          className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold ${
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
          <span className="inline-flex items-center whitespace-nowrap rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-[0.7rem] text-accent">
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
          : low.includes("destroyed") || low === "rejected" || low === "out of stock" || low.includes("lost")
            ? "border-danger/35 bg-danger/15 text-danger"
            : low === "pending" || low === "low stock" || low.includes("damaged") || low.includes("repair")
              ? "border-warn/35 bg-warn/15 text-warn"
              : "border-white/12 bg-white/8 text-tl/80";
      return (
        <span
          className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold capitalize ${tone}`}
        >
          {str}
        </span>
      );
    }
    if (colKey === "catalog_code") {
      const code =
        str && str !== "undefined" && str !== "null"
          ? str
          : "CAT-AUTO";
      return (
        <span className="inline-flex items-center whitespace-nowrap rounded-md border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-[0.72rem] font-bold text-accent">
          {code}
        </span>
      );
    }
    if (colKey === "book_id" || (colKey === "id" && resource === "books")) {
      return (
        <span className="inline-flex items-center whitespace-nowrap rounded-md border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-[0.72rem] font-bold text-accent">
          #{str}
        </span>
      );
    }
    if (colKey === "damaged_copies") {
      const num = Number(str);
      return (
        <span
          className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[0.72rem] font-bold ${
            num > 0
              ? "border border-warn/35 bg-warn/15 text-warn"
              : "text-white/45"
          }`}
        >
          {num}
        </span>
      );
    }
    if (colKey === "destroyed_copies" || colKey === "lost_copies") {
      const num = Number(str);
      return (
        <span
          className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[0.72rem] font-bold ${
            num > 0
              ? "border border-danger/35 bg-danger/15 text-danger"
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
          className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[0.72rem] font-bold ${
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
            {title} <span className="text-accent">{accentWord}</span>
          </h1>
          <p className="mt-1 text-[0.85rem] text-tl">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setSelectedCategory("All");
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-tl transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Reset filters
            </button>
          )}
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
          <LibraryTooltip label="Refresh records">
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

      {/* Unified Browse-Catalog Command Search & Filter Bar */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Elevated 48px Pill Search Input */}
          <div className="group relative flex-1">
            <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-accent/20 via-accent2/10 to-accent/20 opacity-0 blur transition duration-300 group-focus-within:opacity-100" />
            <div className="relative flex h-[48px] items-center rounded-2xl border border-white/12 bg-bg1/90 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-200 focus-within:border-accent/50 focus-within:bg-bg1">
              <Search className="h-4.5 w-4.5 shrink-0 text-accent/80 transition-transform duration-200 group-focus-within:scale-110" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  SEARCH_PLACEHOLDERS[resource] ||
                  `Search ${rows.length} ${resource.replace(/_/g, " ")} record(s)...`
                }
                className="w-full bg-transparent py-2 pl-3 pr-3 text-[0.9rem] text-white placeholder:text-white/38 focus:outline-none"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    searchInputRef.current?.focus();
                  }}
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

          {/* Filter Popovers + Quick Toggles + Sort Popover + Counter Pill */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Collection Popover (for books & inventory — matches Browse Catalog) */}
            {(resource === "books" || resource === "inventory") && categories.length > 1 && (
              <div ref={categoryMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryMenuOpen((v) => !v);
                    setConditionMenuOpen(false);
                    setSortMenuOpen(false);
                  }}
                  aria-expanded={categoryMenuOpen}
                  className={`inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition-all ${
                    selectedCategory !== "All"
                      ? "border-accent/45 bg-accent/15 text-accent shadow-[0_0_20px_rgba(147,197,253,0.14)]"
                      : "border-white/12 bg-bg1/85 text-white/80 hover:border-white/22 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Layers className="h-4 w-4 text-accent/80" />
                  <span className="text-white/45">Collection:</span>
                  <span className="max-w-[140px] truncate text-white">
                    {selectedCategory === "All" ? "All Subjects" : selectedCategory}
                  </span>
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.66rem] text-white/75">
                    {selectedCategory === "All"
                      ? rows.length
                      : (categoryCounts.get(selectedCategory) ?? 0)}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-white/45 transition-transform duration-200 ${
                      categoryMenuOpen ? "rotate-180 text-accent" : ""
                    }`}
                  />
                </button>

                {categoryMenuOpen && (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[300px] sm:w-[420px] rounded-2xl border border-white/14 bg-bg1/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                    <div className="mb-2 flex items-center justify-between px-1.5">
                      <span className="text-[0.7rem] font-bold uppercase tracking-wider text-white/45">
                        Filter by Collection ({categories.length - 1} subjects)
                      </span>
                      {selectedCategory !== "All" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory("All");
                            setCategoryMenuOpen(false);
                          }}
                          className="cursor-pointer text-[0.72rem] font-semibold text-accent hover:underline"
                        >
                          Show All
                        </button>
                      )}
                    </div>
                    <div className="grid max-h-[280px] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                      {categories.map((cat) => {
                        const active = selectedCategory === cat;
                        const count =
                          cat === "All" ? rows.length : (categoryCounts.get(cat) ?? 0);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(cat);
                              setCategoryMenuOpen(false);
                            }}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                              active
                                ? "bg-accent text-on-accent font-semibold shadow-sm"
                                : "text-white/75 hover:bg-white/8 hover:text-white"
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              {active ? (
                                <Check className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/45" />
                              )}
                              <span className="truncate">
                                {cat === "All" ? "All Collections" : cat}
                              </span>
                            </span>
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[0.66rem] ${
                                active
                                  ? "bg-black/20 text-on-accent"
                                  : "bg-white/8 text-white/50"
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Condition / Status Popover Dropdown */}
            {statusFilterOptions.length > 0 && (
              <div ref={conditionMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setConditionMenuOpen((v) => !v);
                    setCategoryMenuOpen(false);
                    setSortMenuOpen(false);
                  }}
                  aria-expanded={conditionMenuOpen}
                  className={`inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition-all ${
                    statusFilter !== "all"
                      ? "border-accent/45 bg-accent/15 text-accent shadow-[0_0_20px_rgba(147,197,253,0.14)]"
                      : "border-white/12 bg-bg1/85 text-white/80 hover:border-white/22 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5 text-accent/80" />
                  <span className="text-white/45">
                    {resource === "books" || resource === "inventory"
                      ? "Condition:"
                      : "Status:"}
                  </span>
                  <span className="whitespace-nowrap text-white">{activeStatusLabel}</span>
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.66rem] text-white/75">
                    {statusCounts.get(statusFilter) ?? rows.length}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-white/45 transition-transform duration-200 ${
                      conditionMenuOpen ? "rotate-180 text-accent" : ""
                    }`}
                  />
                </button>

                {conditionMenuOpen && (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[265px] rounded-2xl border border-white/14 bg-bg1/95 p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                    <div className="mb-1.5 px-2 text-[0.68rem] font-bold uppercase tracking-wider text-white/45">
                      Filter by{" "}
                      {resource === "books" || resource === "inventory"
                        ? "Copy Condition"
                        : "Record Status"}
                    </div>
                    <div className="space-y-1">
                      {statusFilterOptions.map((opt) => {
                        const active = statusFilter === opt.id;
                        const count = statusCounts.get(opt.id) ?? 0;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setStatusFilter(opt.id);
                              setConditionMenuOpen(false);
                              if (opt.id === "damaged") {
                                setSortCol("damaged_copies");
                                setSortDir("desc");
                              } else if (opt.id === "destroyed") {
                                setSortCol("destroyed_copies");
                                setSortDir("desc");
                              } else if (opt.id === "lost") {
                                setSortCol("lost_copies");
                                setSortDir("desc");
                              } else if (opt.id === "available" || opt.id === "all_good") {
                                setSortCol("available_copies");
                                setSortDir("desc");
                              }
                            }}
                            className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                              active
                                ? "bg-accent text-on-accent font-semibold"
                                : "text-white/75 hover:bg-white/8 hover:text-white"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {active ? (
                                <Check className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/45" />
                              )}
                              <span>{opt.label}</span>
                            </span>
                            <span
                              className={`rounded-md px-1.5 py-0.5 font-mono text-[0.65rem] ${
                                active
                                  ? "bg-black/20 text-on-accent"
                                  : "bg-white/8 text-white/50"
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Available Now One-Click Toggle (on Books & Inventory — matches Browse Catalog) */}
            {(resource === "books" || resource === "inventory") && (
              <button
                type="button"
                onClick={() =>
                  setStatusFilter((prev) => (prev === "available" ? "all" : "available"))
                }
                aria-pressed={statusFilter === "available"}
                className={`inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition-all ${
                  statusFilter === "available"
                    ? "border-accent2/45 bg-accent2/15 text-accent2 shadow-[0_0_20px_rgba(125,212,168,0.12)]"
                    : "border-white/12 bg-bg1/85 text-white/75 hover:border-white/22 hover:bg-white/8 hover:text-white"
                }`}
              >
                <CheckCircle2
                  className={`h-4 w-4 ${
                    statusFilter === "available" ? "text-accent2" : "text-white/40"
                  }`}
                />
                Available Now
              </button>
            )}

            {/* Sort Popover Dropdown (matches Browse Catalog) */}
            <div ref={sortMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setSortMenuOpen((v) => !v);
                  setConditionMenuOpen(false);
                  setCategoryMenuOpen(false);
                }}
                aria-expanded={sortMenuOpen}
                className="inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-bg1/85 px-4 text-xs font-semibold text-white/80 transition hover:border-white/22 hover:bg-white/8 hover:text-white"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-accent/80" />
                <span className="text-white/45">Sort:</span>
                <span className="whitespace-nowrap text-white">{activeSortLabel}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-white/45 transition-transform duration-200 ${
                    sortMenuOpen ? "rotate-180 text-accent" : ""
                  }`}
                />
              </button>

              {sortMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[230px] rounded-2xl border border-white/14 bg-bg1/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                  <div className="mb-1 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-white/45">
                    Sort Columns
                  </div>
                  {columns.map((col) => {
                    const active = sortCol === col.key;
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() => {
                          toggleSort(col.key);
                          setSortMenuOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                          active
                            ? "bg-accent text-on-accent font-semibold"
                            : "text-white/75 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <span>{col.label}</span>
                        {active && (
                          <span className="font-mono text-[0.7rem]">
                            {sortDir === "asc" ? "↑ ASC" : "↓ DESC"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Results Counter Pill */}
            <div className="ml-auto flex h-[48px] items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 text-xs text-tl lg:ml-0">
              <SlidersHorizontal className="h-3.5 w-3.5 text-accent/70" />
              <span className="whitespace-nowrap">
                <strong className="font-semibold text-white">{filtered.length}</strong> /{" "}
                {rows.length}
              </span>
            </div>
          </div>
        </div>

        {/* Active Filter Dismissal Chips (matches Browse Catalog) */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="text-[0.72rem] font-semibold uppercase tracking-wider text-white/40">
              Active filters:
            </span>
            {selectedCategory !== "All" && (
              <button
                type="button"
                onClick={() => setSelectedCategory("All")}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/12 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/20"
              >
                <span>Collection: {selectedCategory}</span>
                <X className="h-3 w-3" />
              </button>
            )}
            {statusFilter !== "all" && (
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-accent2/30 bg-accent2/12 px-2.5 py-1 text-xs font-medium text-accent2 transition hover:bg-accent2/20"
              >
                <span>{activeStatusLabel}</span>
                <X className="h-3 w-3" />
              </button>
            )}
            {search.trim() !== "" && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-2.5 py-1 text-xs font-medium text-white/85 transition hover:bg-white/14"
              >
                <span>Query: &ldquo;{search.trim()}&rdquo;</span>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/25 bg-danger/10 p-5 text-sm text-danger">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error.message || "Unable to load library records."}</span>
          </div>
          <Button variant="accent" size="sm" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2.5 rounded-2xl border border-white/8 bg-card-glass p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-xl bg-white/6" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-card-glass p-12 text-center">
          <Database className="mx-auto mb-3 h-9 w-9 text-accent/50" />
          <h3 className="text-sm font-bold text-white">No records found</h3>
          <p className="mt-1 text-xs text-tl">
            {rows.length === 0
              ? "Run 001_initial_schema.sql and 002_seed_data.sql in the Supabase SQL Editor to seed records."
              : "No rows match your current filter query."}
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
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* Inspect full record */}
                          <LibraryTooltip label="Inspect Details & Physical Copies">
                            <button
                              type="button"
                              onClick={() => setModal({ type: "inspect", row })}
                              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/12 bg-bg1/80 px-2.5 text-[0.72rem] font-semibold text-tl transition hover:border-accent/45 hover:bg-accent/12 hover:text-accent cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">Inspect</span>
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
                                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-accent2/35 bg-accent2/12 px-2.5 text-[0.72rem] font-semibold text-accent2 transition hover:bg-accent2/22 cursor-pointer"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span className="hidden xl:inline">Approve</span>
                                </button>
                              </LibraryTooltip>
                              <LibraryTooltip label="Reject Request">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setModal({ type: "review", row, decision: "reject" })
                                  }
                                  className="inline-flex h-8 items-center gap-1 rounded-xl border border-danger/35 bg-danger/12 px-2.5 text-[0.72rem] font-semibold text-danger transition hover:bg-danger/22 cursor-pointer"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  <span className="hidden xl:inline">Reject</span>
                                </button>
                              </LibraryTooltip>
                            </>
                          )}
                          {resource === "account_requests" && row.status !== "pending" && (
                            <LibraryTooltip label="Delete Processed Request">
                              <button
                                type="button"
                                onClick={() => setModal({ type: "delete", row })}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger transition hover:bg-danger/20 cursor-pointer"
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
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-accent2/30 bg-accent2/12 text-accent2 transition hover:bg-accent2/25 cursor-pointer"
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
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-warn/30 bg-warn/12 text-warn transition hover:bg-warn/25 cursor-pointer"
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
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/12 bg-bg1/80 text-tl/80 transition hover:border-warn/40 hover:text-warn cursor-pointer"
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
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/12 bg-bg1/80 text-tl/80 transition hover:border-accent/40 hover:text-accent cursor-pointer"
                                  >
                                    <KeyRound className="h-3.5 w-3.5" />
                                  </button>
                                </LibraryTooltip>
                                <LibraryTooltip label="Delete Account">
                                  <button
                                    type="button"
                                    onClick={() => setModal({ type: "delete", row })}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger transition hover:bg-danger/20 cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </LibraryTooltip>
                              </>
                            )}

                          {/* Books, Inventory, Cards, Events, & Announcements Edit */}
                          {(resource === "books" ||
                            resource === "inventory" ||
                            resource === "library_cards" ||
                            resource === "events" ||
                            resource === "announcements") && (
                            <LibraryTooltip label="Edit Record & Copy Conditions">
                              <button
                                type="button"
                                onClick={() => setModal({ type: "edit", row })}
                                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/12 px-2.5 text-[0.72rem] font-semibold text-accent transition hover:bg-accent/22 cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">Edit</span>
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
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
                                  row.pinned
                                    ? "border-gold/40 bg-gold/15 text-gold"
                                    : "border-white/12 bg-bg1/80 text-tl/70 hover:text-white"
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
                                className="inline-flex h-8 items-center gap-1 rounded-xl border border-accent2/35 bg-accent2/12 px-2.5 text-[0.72rem] font-semibold text-accent2 transition hover:bg-accent2/25 cursor-pointer"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">Return</span>
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
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger transition hover:bg-danger/20 cursor-pointer"
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
        onClose={handleCloseModal}
        onCompleted={handleModalCompleted}
      />
    </StaffShell>
  );
}
