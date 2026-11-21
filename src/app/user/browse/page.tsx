"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { BookOpen, Heart, RefreshCw, Search, X } from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { BookCard } from "@/components/catalog/BookCard";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";
import { Button } from "@/components/ui/button";
import { apiMutate, swrPrivateConfig, swrPublicConfig } from "@/lib/api";
import type { Book, BooksApiResponse } from "@/types/library";

export default function UserBrowsePage() {
  const [query, setQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [activeBook, setActiveBook] = useState<Book | null>(null);

  const { data, isLoading, mutate } = useSWR<BooksApiResponse>(
    "/api/public/books",
    swrPublicConfig
  );
  const { data: favData, mutate: mutateFavs } = useSWR<{
    ok?: boolean;
    favoriteBookIds?: number[];
  }>("/api/user/favorites", swrPrivateConfig);

  const favoriteIds = useMemo(
    () => new Set<number>(favData?.favoriteBookIds ?? []),
    [favData]
  );

  // Record debounced search queries to member search history
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) return;
    const timer = window.setTimeout(() => {
      apiMutate("/api/user/search-history", {
        method: "POST",
        body: { query: trimmed },
      }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const toggleFavorite = async (bookId: number) => {
    try {
      await apiMutate("/api/user/favorites", {
        method: "POST",
        body: { book_id: bookId },
      });
      await mutateFavs();
    } catch {
      // ignore
    }
  };

  const books = data?.books ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (onlyFavorites && !favoriteIds.has(b.id)) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.call_number.toLowerCase().includes(q)
      );
    });
  }, [books, query, onlyFavorites, favoriteIds]);

  return (
    <MemberShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
            Member <span className="text-accent">Book Catalog</span>
          </h1>
          <p className="mt-1 text-sm text-tl/80">
            Browse {books.length.toLocaleString()} books with real-time copy availability and saved
            favorites.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            aria-pressed={onlyFavorites}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              onlyFavorites
                ? "border-danger/45 bg-danger/15 text-danger"
                : "border-white/12 bg-white/5 text-tl/80 hover:border-white/20 hover:text-white"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${onlyFavorites ? "fill-current" : ""}`} />
            Favorites ({favoriteIds.size})
          </button>
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
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
          <p className="text-sm font-semibold text-white">
            {onlyFavorites ? "No favorite books saved yet." : "No books match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((book) => {
            const isFav = favoriteIds.has(book.id);
            return (
              <div key={book.id} className="relative">
                <BookCard book={book} onSelect={setActiveBook} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(book.id);
                  }}
                  aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                  className={`absolute right-2.5 top-2.5 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border backdrop-blur-md transition ${
                    isFav
                      ? "border-danger/40 bg-danger/25 text-danger"
                      : "border-white/15 bg-bg1/75 text-white/65 hover:text-danger"
                  }`}
                >
                  <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <BookDetailModal book={activeBook} onClose={() => setActiveBook(null)} />
    </MemberShell>
  );
}
