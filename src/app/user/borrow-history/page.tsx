"use client";

import useSWR from "swr";
import { CheckCircle2, History, RefreshCw } from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { Button } from "@/components/ui/button";
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
}

export default function UserBorrowHistoryPage() {
  const { data, isLoading, mutate } = useSWR<{ ok: boolean; returns: ReturnHistoryItem[] }>(
    "/api/user/return-history",
    swrPrivateConfig
  );
  const returns = data?.returns ?? [];

  return (
    <MemberShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
            Borrowing <span className="text-accent">History</span>
          </h1>
          <p className="mt-1 text-sm text-tl/80">
            Archive of your previously borrowed and returned library materials.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => mutate()}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : returns.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card-glass p-12 text-center">
          <History className="mx-auto mb-3 h-10 w-10 text-accent/55" />
          <h2 className="text-base font-bold text-white">No Past Return Records Yet</h2>
          <p className="mx-auto mt-1.5 max-w-[420px] text-xs leading-relaxed text-tl/75">
            Completed returns processed by library staff will be logged here automatically.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-glass backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/4 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-accent">
                  <th className="px-4 py-3 font-semibold">Book Title</th>
                  <th className="px-4 py-3 font-semibold">Author</th>
                  <th className="px-4 py-3 font-semibold">ISBN</th>
                  <th className="px-4 py-3 font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">Returned On</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-white/4">
                    <td className="px-4 py-3 font-semibold text-white">{r.book_title}</td>
                    <td className="px-4 py-3 text-tl/85">{r.book_author || "—"}</td>
                    <td className="px-4 py-3 font-mono text-tl/70">{r.book_isbn || "—"}</td>
                    <td className="px-4 py-3 font-mono text-white">{r.qty_returned}</td>
                    <td className="px-4 py-3 font-mono text-tl">{r.return_date || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-accent2/30 bg-accent2/12 px-2.5 py-0.5 text-[0.68rem] font-bold text-accent2">
                        <CheckCircle2 className="h-3 w-3" /> Returned
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </MemberShell>
  );
}
