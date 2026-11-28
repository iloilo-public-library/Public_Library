"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  BookmarkCheck,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { Button } from "@/components/ui/button";
import { formatPhp } from "@/components/circulation/types";
import { apiMutate, swrPrivateConfig } from "@/lib/api";

interface BorrowedBookItem {
  id: number;
  card_id: number;
  book_id: number | null;
  book_title: string;
  book_author: string;
  book_isbn: string;
  quantity: number;
  date_issued: string | null;
  date_return: string | null;
  card_type_category: string;
  loan_status?: "borrowed" | "overdue" | "returned" | "lost" | string;
  overdue_days?: number;
  fine_amount?: number;
  can_renew: boolean;
  renew_block_reason?: string | null;
  has_pending_renewal: boolean;
}

interface BorrowedResponse {
  ok: boolean;
  borrowedBooks: BorrowedBookItem[];
}

function getRenewBlockLabel(reason?: string | null): string {
  switch (reason) {
    case "pending_renewal":
      return "Renewal pending staff approval";
    case "expired":
      return "Card expired — renew at library";
    case "overdue":
      return "Overdue — return at library";
    case "unpaid_fines":
      return "Blocked by unpaid fines";
    case "max_renewals":
      return "Max renewals (2) used";
    case "reserved":
      return "Reserved by another patron";
    case "returned":
      return "Loan already closed";
    default:
      return reason || "Not eligible for renewal";
  }
}

export default function UserBorrowedPage() {
  const { data, error, isLoading, mutate } = useSWR<BorrowedResponse>(
    "/api/user/borrowed-books",
    swrPrivateConfig
  );
  const [renewingCardId, setRenewingCardId] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "renewable" | "pending_renewal" | "overdue">("all");
  const [sortBy, setSortBy] = useState<"due" | "title">("due");
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const books = useMemo(() => data?.borrowedBooks ?? [], [data?.borrowedBooks]);

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = books.filter((item) => {
      const isOverdue = item.loan_status === "overdue" || Number(item.overdue_days ?? 0) > 0;
      if (statusFilter === "renewable" && !item.can_renew) return false;
      if (statusFilter === "pending_renewal" && !item.has_pending_renewal) return false;
      if (statusFilter === "overdue" && !isOverdue) return false;
      if (!q) return true;
      return (
        item.book_title.toLowerCase().includes(q) ||
        item.book_author.toLowerCase().includes(q) ||
        (item.book_isbn || "").toLowerCase().includes(q) ||
        String(item.card_id).includes(q) ||
        String(item.book_id ?? "").includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === "title") {
        return a.book_title.localeCompare(b.book_title);
      }
      return String(a.date_return || "9999").localeCompare(String(b.date_return || "9999"));
    });
  }, [books, query, statusFilter, sortBy]);

  const handleRenew = async (cardId: number) => {
    setRenewingCardId(cardId);
    setBanner(null);
    try {
      await apiMutate("/api/user/renew", {
        method: "POST",
        body: { card_id: cardId },
      });
      setBanner({
        type: "ok",
        text: `Renewal request submitted for Card #${cardId}. Awaiting library staff approval.`,
      });
      await mutate();
    } catch (err) {
      setBanner({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to submit renewal request.",
      });
    } finally {
      setRenewingCardId(null);
    }
  };

  return (
    <MemberShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold uppercase">
            Member Portal &middot; Active Loans
          </div>
          <h1 className="font-serif text-[clamp(1.85rem,3vw,2.5rem)] font-bold leading-tight tracking-[-0.02em] text-white">
            My <span className="text-accent">Borrowed Books</span>
          </h1>
          <p className="mt-1 text-sm text-tl/80">
            Track active loans, due dates, overdue fines, and library card renewal eligibility.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(query.trim() !== "" || statusFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-tl transition hover:border-white/20 hover:text-white"
            >
              <X className="h-3.5 w-3.5" /> Reset
            </button>
          )}
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Unified Browse-Catalog Command Search & Filter Bar */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="group relative flex-1">
          <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-accent/20 via-accent2/10 to-accent/20 opacity-0 blur transition duration-300 group-focus-within:opacity-100" />
          <div className="relative flex h-[48px] items-center rounded-2xl border border-white/12 bg-bg1/90 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-200 focus-within:border-accent/50 focus-within:bg-bg1">
            <Search className="h-4.5 w-4.5 shrink-0 text-accent/80" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search borrowed books by title, author, ISBN, or Card #…"
              aria-label="Search borrowed books"
              className="w-full bg-transparent py-2 pl-3 pr-3 text-[0.9rem] text-white placeholder:text-white/38 focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/8 text-white/60 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden shrink-0 items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[0.68rem] text-white/45 sm:inline-flex">
                ⌘K
              </kbd>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: "All Loans" },
              { id: "renewable", label: "Eligible to Renew" },
              { id: "pending_renewal", label: "Pending Approval" },
              { id: "overdue", label: "Overdue" },
            ] as const
          ).map((pill) => {
            const active = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(pill.id)}
                className={`inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition-all ${
                  active
                    ? pill.id === "overdue"
                      ? "border-danger/45 bg-danger/15 text-danger"
                      : "border-accent/45 bg-accent/15 text-accent shadow-[0_0_20px_rgba(147,197,253,0.14)]"
                    : "border-white/12 bg-bg1/85 text-white/80 hover:border-white/22 hover:bg-white/8 hover:text-white"
                }`}
              >
                {pill.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSortBy((s) => (s === "due" ? "title" : "due"))}
            className="inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-bg1/85 px-4 text-xs font-semibold text-white/80 transition hover:border-white/22 hover:bg-white/8 hover:text-white"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-accent/80" />
            <span className="text-white/45">Sort:</span>
            <span className="text-white">{sortBy === "due" ? "Due Date" : "Title (A–Z)"}</span>
          </button>

          <div className="ml-auto flex h-[48px] items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 text-xs text-tl lg:ml-0">
            <SlidersHorizontal className="h-3.5 w-3.5 text-accent/70" />
            <span className="whitespace-nowrap">
              <strong className="font-semibold text-white">{filteredBooks.length}</strong> /{" "}
              {books.length}
            </span>
          </div>
        </div>
      </div>

      {banner && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs ${
            banner.type === "ok"
              ? "border-accent2/30 bg-accent2/12 text-accent2"
              : "border-danger/30 bg-danger/12 text-danger"
          }`}
        >
          {banner.type === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/25 bg-danger/10 p-6 text-xs text-danger"
        >
          <span>Unable to load borrowed books. Please try again.</span>
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-12 text-center backdrop-blur-md">
          <BookmarkCheck className="mx-auto mb-3 h-10 w-10 text-accent/55" />
          <h2 className="text-base font-bold text-white">
            {books.length === 0 ? "No Active Borrowed Books" : "No Matching Loans Found"}
          </h2>
          <p className="mx-auto mt-1.5 max-w-[420px] text-xs leading-relaxed text-tl/75">
            {books.length === 0
              ? "Books checked out using your Iloilo City Public Library card will appear here with due dates and renewal options."
              : "Try clearing your search or status filter to view all active loans."}
          </p>
          <Button variant="accent" size="sm" className="mt-5" asChild>
            <Link href="/user/browse">
              <BookOpen className="h-4 w-4" /> Browse Catalog
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredBooks.map((item) => {
            const overdueDays = Number(item.overdue_days ?? 0);
            const fineAmount = Number(item.fine_amount ?? 0);
            const isOverdue = item.loan_status === "overdue" || overdueDays > 0;

            return (
              <article
                key={`${item.card_id}-${item.id}`}
                className="flex flex-col justify-between rounded-[22px] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-md transition duration-200 hover:border-white/20"
              >
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="whitespace-nowrap rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold text-accent">
                      Card #{item.card_id}
                      {item.book_id ? ` · Book #${item.book_id}` : ""} · Qty {item.quantity}
                    </span>

                    <div className="flex items-center gap-2">
                      {isOverdue ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-danger/35 bg-danger/12 px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold text-danger">
                          <AlertTriangle className="h-3 w-3" />
                          {overdueDays > 0 ? `${overdueDays}d Overdue` : "Overdue"}
                        </span>
                      ) : (
                        <span className="whitespace-nowrap rounded-full border border-accent2/30 bg-accent2/10 px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold text-accent2">
                          {item.loan_status === "borrowed" ? "Borrowed" : item.loan_status || "Active"}
                        </span>
                      )}

                      {item.date_return && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[0.72rem] text-warn">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Due {item.date_return}
                        </span>
                      )}
                    </div>
                  </div>
                  <h2 className="text-base font-bold text-white">{item.book_title}</h2>
                  <p className="mt-0.5 text-xs text-tl/80">{item.book_author}</p>
                  {item.book_isbn && (
                    <p className="mt-1 font-mono text-[0.7rem] text-white/45">
                      ISBN {item.book_isbn}
                    </p>
                  )}
                  {fineAmount > 0 && (
                    <p className="mt-2 font-mono text-xs font-semibold text-danger">
                      Unpaid Fine: {formatPhp(fineAmount)}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3">
                  <span className="font-mono text-[0.7rem] text-white/50">
                    Issued {item.date_issued || "—"}
                  </span>

                  {item.has_pending_renewal ? (
                    <span className="whitespace-nowrap rounded-lg border border-warn/30 bg-warn/12 px-2.5 py-1 text-[0.7rem] font-semibold text-warn">
                      Renewal Pending Approval
                    </span>
                  ) : item.can_renew ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={renewingCardId === item.card_id}
                      onClick={() => handleRenew(item.card_id)}
                    >
                      {renewingCardId === item.card_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5" />
                      )}
                      Request Renewal
                    </Button>
                  ) : (
                    <span className="text-[0.7rem] text-tl/70">
                      {getRenewBlockLabel(item.renew_block_reason)}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </MemberShell>
  );
}
