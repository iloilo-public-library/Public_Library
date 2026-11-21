"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  BookmarkCheck,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCw,
} from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { Button } from "@/components/ui/button";
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
  can_renew: boolean;
  has_pending_renewal: boolean;
}

interface BorrowedResponse {
  ok: boolean;
  borrowedBooks: BorrowedBookItem[];
}

export default function UserBorrowedPage() {
  const { data, error, isLoading, mutate } = useSWR<BorrowedResponse>(
    "/api/user/borrowed-books",
    swrPrivateConfig
  );
  const [renewingCardId, setRenewingCardId] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const books = data?.borrowedBooks ?? [];

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
          <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
            My <span className="text-accent">Borrowed Books</span>
          </h1>
          <p className="mt-1 text-sm text-tl/80">
            Track active loans, due dates, and library card renewal eligibility.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => mutate()}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {banner && (
        <div
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
        <div className="rounded-2xl border border-danger/25 bg-danger/10 p-6 text-xs text-danger">
          Unable to load borrowed books. Please make sure you are signed in.
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card-glass p-12 text-center">
          <BookmarkCheck className="mx-auto mb-3 h-10 w-10 text-accent/55" />
          <h2 className="text-base font-bold text-white">No Active Borrowed Books</h2>
          <p className="mx-auto mt-1.5 max-w-[420px] text-xs leading-relaxed text-tl/75">
            Books checked out using your Iloilo City Public Library card will appear here with due
            dates and renewal options.
          </p>
          <Button variant="accent" size="sm" className="mt-5" asChild>
            <Link href="/user/browse">
              <BookOpen className="h-4 w-4" /> Browse Catalog
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {books.map((item) => (
            <article
              key={`${item.card_id}-${item.id}`}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-card-glass p-5 backdrop-blur-sm"
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold text-accent">
                    Card #{item.card_id} · Qty {item.quantity}
                  </span>
                  {item.date_return && (
                    <span className="inline-flex items-center gap-1 font-mono text-[0.72rem] text-warn">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Due {item.date_return}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-white">{item.book_title}</h2>
                <p className="mt-0.5 text-xs text-tl/80">{item.book_author}</p>
                {item.book_isbn && (
                  <p className="mt-1 font-mono text-[0.7rem] text-white/45">
                    ISBN {item.book_isbn}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3">
                <span className="font-mono text-[0.7rem] text-white/50">
                  Issued {item.date_issued || "—"}
                </span>
                {item.has_pending_renewal ? (
                  <span className="rounded-full border border-warn/30 bg-warn/12 px-2.5 py-1 text-[0.68rem] font-semibold text-warn">
                    Renewal Pending
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
                  <span className="text-[0.68rem] text-white/40">Max renewals reached</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </MemberShell>
  );
}
