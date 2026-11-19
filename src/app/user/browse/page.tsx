"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { BookOpen, RefreshCw, Search, X } from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { BookCard } from "@/components/catalog/BookCard";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";
import { Button } from "@/components/ui/button";
import { swrPublicConfig } from "@/lib/api";
import type { Book, BooksApiResponse } from "@/types/library";

export default function UserBrowsePage() {
  const [query, setQuery] = useState("");
  const [activeBook, setActiveBook] = useState<Book | null>(null);

  const { data, isLoading, mutate } = useSWR<BooksApiResponse>(
    "/api/public/books",
    swrPublicConfig
  );

  const books = data?.books ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.call_number.toLowerCase().includes(q)
    );
  }, [books, query]);

  return (
    <MemberShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
            Member <span className="text-accent">Book Catalog</span>
          </h1>
          <p className="mt-1 text-sm text-tl/80">
            Browse {books.length.toLocaleString()} books with real-time copy availability.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => mutate()}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent/70" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search catalog by title, author, ISBN, or call number..."
          className="w-full rounded-xl border border-white/10 bg-card-glass py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/40 focus:border-accent/50 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-white/8 bg-card-glass p-12 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-accent/45" />
          <p className="text-sm font-semibold text-white">No books match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((book) => (
            <BookCard key={book.id} book={book} onSelect={setActiveBook} />
          ))}
        </div>
      )}

      <BookDetailModal book={activeBook} onClose={() => setActiveBook(null)} />
    </MemberShell>
  );
}
