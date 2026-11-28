"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  History,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { Button } from "@/components/ui/button";
import { formatPhp } from "@/components/circulation/types";
import { swrPrivateConfig } from "@/lib/api";

interface ReturnHistoryItem {
  id: number;
  return_id: number;
  card_id: number | null;
  date_issued: string;
  return_date: string;
  book_title: string;
  book_author: string;
  book_isbn: string;
  qty_returned: number;
  return_condition?: string;
  loan_status?: string;
  overdue_days?: number;
  fine_amount?: number;
  fine_paid?: boolean;
  fine_waived?: boolean;
}

export default function UserBorrowHistoryPage() {
  const { data, error, isLoading, mutate } = useSWR<{ ok: boolean; returns: ReturnHistoryItem[] }>(
    "/api/user/return-history",
    swrPrivateConfig
  );
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "title">("recent");
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

  const returns = useMemo(() => data?.returns ?? [], [data?.returns]);

  const filteredReturns = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = returns.filter((r) => {
      if (!q) return true;
      return (
        r.book_title.toLowerCase().includes(q) ||
        (r.book_author || "").toLowerCase().includes(q) ||
        (r.book_isbn || "").toLowerCase().includes(q) ||
        (r.return_date || "").toLowerCase().includes(q) ||
        String(r.card_id ?? "").includes(q)
      );
    });
    if (sortBy === "title") {
      return [...list].sort((a, b) => a.book_title.localeCompare(b.book_title));
    }
    return [...list].sort((a, b) => {
      const cmp = String(b.return_date || "").localeCompare(String(a.return_date || ""));
      return cmp !== 0 ? cmp : Number(b.id) - Number(a.id);
    });
  }, [returns, query, sortBy]);

  return (
    <MemberShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold uppercase">
            Member Portal &middot; Borrowing Archive
          </div>
          <h1 className="font-serif text-[clamp(1.85rem,3vw,2.5rem)] font-bold leading-tight tracking-[-0.02em] text-white">
            Borrowing <span className="text-accent">History</span>
          </h1>
          <p className="mt-1 text-sm text-tl/80">
            Archive of your previously borrowed and returned library materials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {query.trim() !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
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

      {/* Unified Browse-Catalog Command Search & Sort Bar */}
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
              placeholder="Search returned books by title, author, ISBN, Card #, or date…"
              aria-label="Search borrowing history"
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
          <button
            type="button"
            onClick={() => setSortBy((s) => (s === "recent" ? "title" : "recent"))}
            className="inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-bg1/85 px-4 text-xs font-semibold text-white/80 transition hover:border-white/22 hover:bg-white/8 hover:text-white"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-accent/80" />
            <span className="text-white/45">Sort:</span>
            <span className="text-white">
              {sortBy === "recent" ? "Most Recent Return" : "Title (A–Z)"}
            </span>
          </button>

          <div className="ml-auto flex h-[48px] items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 text-xs text-tl lg:ml-0">
            <SlidersHorizontal className="h-3.5 w-3.5 text-accent/70" />
            <span className="whitespace-nowrap">
              <strong className="font-semibold text-white">{filteredReturns.length}</strong> /{" "}
              {returns.length}
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/25 bg-danger/10 p-6 text-xs text-danger"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Unable to load borrowing history. Please try again.
          </span>
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-12 text-center backdrop-blur-md">
          <History className="mx-auto mb-3 h-10 w-10 text-accent/55" />
          <h2 className="text-base font-bold text-white">
            {returns.length === 0 ? "No Past Return Records Yet" : "No Matching Returns"}
          </h2>
          <p className="mx-auto mt-1.5 max-w-[420px] text-xs leading-relaxed text-tl/75">
            {returns.length === 0
              ? "Completed returns processed by library staff will be logged here automatically."
              : "No returned items match your current search filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/4 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-accent">
                  <th className="px-4 py-3 font-semibold">Book Title</th>
                  <th className="px-4 py-3 font-semibold">Author / ISBN</th>
                  <th className="px-4 py-3 font-semibold">Qty Returned</th>
                  <th className="px-4 py-3 font-semibold">Condition</th>
                  <th className="px-4 py-3 font-semibold">Dates</th>
                  <th className="px-4 py-3 font-semibold">Fine / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {filteredReturns.map((r) => {
                  const fineVal = Number(r.fine_amount ?? 0);
                  const overdueDays = Number(r.overdue_days ?? 0);
                  const cond = r.return_condition || "Good";
                  const isIncident = cond === "Damaged" || cond === "Destroyed" || cond === "Lost";

                  return (
                    <tr key={r.id} className="hover:bg-white/4">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{r.book_title}</div>
                        <div className="font-mono text-[0.68rem] text-tl/65">
                          Card #{r.card_id ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-tl/85">
                        <div>{r.book_author || "—"}</div>
                        {r.book_isbn && (
                          <div className="font-mono text-[0.68rem] text-tl/65">{r.book_isbn}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-white">×{r.qty_returned}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold ${
                            isIncident
                              ? "border-danger/35 bg-danger/12 text-danger"
                              : "border-accent2/30 bg-accent2/12 text-accent2"
                          }`}
                        >
                          {isIncident ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {cond}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-tl">
                        <div>Returned: {r.return_date || "—"}</div>
                        {r.date_issued && (
                          <div className="text-[0.68rem] text-tl/65">Issued: {r.date_issued}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {r.fine_waived ? (
                          <span className="text-accent2">Waived</span>
                        ) : fineVal > 0 ? (
                          <span className={r.fine_paid ? "text-accent2" : "text-danger"}>
                            {formatPhp(fineVal)} {r.fine_paid ? "(Paid)" : "(Unpaid)"}
                            {overdueDays > 0 ? ` · ${overdueDays}d` : ""}
                          </span>
                        ) : overdueDays > 0 ? (
                          <span className="text-tl/80">{overdueDays}d late</span>
                        ) : (
                          <span className="text-accent2">On time</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </MemberShell>
  );
}
