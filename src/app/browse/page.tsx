"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { BookOpen, ChevronLeft, ChevronRight, RefreshCw, Search, X } from "lucide-react";
import { PublicTopbar } from "@/components/landing/PublicTopbar";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { MembershipModal } from "@/components/landing/MembershipModal";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";
import { BookCard } from "@/components/catalog/BookCard";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";
import { Button } from "@/components/ui/button";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { swrPublicConfig } from "@/lib/api";
import type { Book, BooksApiResponse } from "@/types/library";

const PER_PAGE = 30;

export default function PublicBrowsePage() {
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [activeBook, setActiveBook] = useState<Book | null>(null);

  const { data, error, isLoading, mutate } = useSWR<BooksApiResponse>(
    "/api/public/books",
    swrPublicConfig
  );

  const books = data?.books ?? [];

  const categories = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      const cat = (b.category || b.genre || "").trim();
      if (cat) set.add(cat);
    });
    return ["All", ...Array.from(set).sort()];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      const cat = (b.category || b.genre || "").trim();
      if (selectedCategory !== "All" && cat !== selectedCategory) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.call_number.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }, [books, query, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pagedBooks = filteredBooks.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <div className="min-h-screen">
      <PublicTopbar onOpenMemberModal={() => setMemberModalOpen(true)} activePath="/browse" />

      <main className="mx-auto max-w-[1360px] px-4 pb-16 pt-[88px] md:px-10">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-accent">
              <BookOpen className="h-3.5 w-3.5" /> Public Catalog
            </div>
            <h1 className="text-[1.85rem] font-bold tracking-[-0.03em] text-white">
              Browse <span className="text-accent">Library Collection</span>
            </h1>
            <p className="mt-1 text-[0.86rem] text-tl">
              Explore {books.length.toLocaleString()} cataloged titles with live availability.
            </p>
          </div>

          <LibraryTooltip label="Refresh catalog cache">
            <Button variant="secondary" size="sm" onClick={() => mutate()}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </LibraryTooltip>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="mb-6 space-y-3 rounded-2xl border border-white/8 bg-card-glass p-4 backdrop-blur-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent/70" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, author, ISBN, call number, or category..."
              className="w-full rounded-xl border border-white/10 bg-bg1/75 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/38 focus:border-accent/50 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.slice(0, 14).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-[0.76rem] font-semibold transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-accent text-on-accent"
                    : "border border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results State */}
        {error ? (
          <div className="rounded-2xl border border-danger/25 bg-danger/10 p-8 text-center">
            <p className="text-sm font-semibold text-danger">
              Unable to reach the Flask catalog API (`/api/public/books`). Make sure the Python
              backend is running on port 5000.
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className="aspect-[3/4] animate-pulse rounded-2xl border border-white/8 bg-white/5"
              />
            ))}
          </div>
        ) : pagedBooks.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-card-glass p-12 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-accent/45" />
            <h3 className="text-base font-bold text-white">No matching books found</h3>
            <p className="mt-1 text-xs text-tl/70">
              Try adjusting your search keywords or selecting another category.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {pagedBooks.map((book) => (
                <BookCard key={book.id} book={book} onSelect={setActiveBook} />
              ))}
            </div>

            {/* Pagination (30 per page) */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="font-mono text-xs text-tl">
                  Page {safePage} of {totalPages} ({filteredBooks.length} books)
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <PublicFooter onOpenLegal={setLegalModal} />

      <BookDetailModal book={activeBook} onClose={() => setActiveBook(null)} />
      <MembershipModal open={memberModalOpen} onOpenChange={setMemberModalOpen} />
      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
