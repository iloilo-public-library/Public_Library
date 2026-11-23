"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  ArrowUpDown,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Heart,
  Layers,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { BookCard } from "@/components/catalog/BookCard";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";
import { Button } from "@/components/ui/button";
import { apiMutate, swrPrivateConfig, swrPublicConfig } from "@/lib/api";
import type { Book, BooksApiResponse } from "@/types/library";

export default function UserBrowsePage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<"title" | "author" | "available">("title");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [activeBook, setActiveBook] = useState<Book | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        setCategoryMenuOpen(false);
        setSortMenuOpen(false);
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setCategoryMenuOpen(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

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

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    books.forEach((b) => {
      const cat = (b.category || b.genre || "").trim();
      if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });
    return counts;
  }, [books]);

  const categories = useMemo(() => {
    return ["All", ...Array.from(categoryCounts.keys()).sort()];
  }, [categoryCounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = books.filter((b) => {
      const cat = (b.category || b.genre || "").trim();
      if (selectedCategory !== "All" && cat !== selectedCategory) return false;
      if (onlyAvailable && !(b.is_borrowable && b.available_copies > 0)) return false;
      if (onlyFavorites && !favoriteIds.has(b.id)) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.call_number.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === "available") return (b.available_copies || 0) - (a.available_copies || 0);
      if (sortBy === "author") return (a.author || "").localeCompare(b.author || "");
      return (a.title || "").localeCompare(b.title || "");
    });
  }, [books, query, selectedCategory, onlyAvailable, onlyFavorites, favoriteIds, sortBy]);

  const hasActiveFilters =
    query.trim() !== "" || selectedCategory !== "All" || onlyAvailable || onlyFavorites;

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
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedCategory("All");
                setOnlyAvailable(false);
                setOnlyFavorites(false);
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

      {/* Unified Command Search & Filter Bar */}
      <div className="mb-7 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <div className="flex h-[48px] items-center rounded-2xl border border-white/12 bg-bg1/90 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition focus-within:border-accent/50">
            <Search className="h-4.5 w-4.5 shrink-0 text-accent/80" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, authors, ISBN, call number, or subject..."
              className="w-full bg-transparent py-2 pl-3 pr-3 text-[0.92rem] text-white placeholder:text-white/38 focus:outline-none"
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

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Collection Popover */}
          <div ref={categoryMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setCategoryMenuOpen((v) => !v);
                setSortMenuOpen(false);
              }}
              className={`inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition ${
                selectedCategory !== "All"
                  ? "border-accent/45 bg-accent/15 text-accent"
                  : "border-white/12 bg-bg1/85 text-white/80 hover:border-white/22 hover:text-white"
              }`}
            >
              <Layers className="h-4 w-4 text-accent/80" />
              <span className="max-w-[140px] truncate">
                {selectedCategory === "All" ? "All Collections" : selectedCategory}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-white/45" />
            </button>

            {categoryMenuOpen && (
              <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[300px] sm:w-[400px] rounded-2xl border border-white/14 bg-bg1/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                <div className="grid max-h-[280px] grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {categories.map((cat) => {
                    const active = selectedCategory === cat;
                    const count = cat === "All" ? books.length : (categoryCounts.get(cat) ?? 0);
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
                            ? "bg-accent text-on-accent font-semibold"
                            : "text-white/75 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <span className="truncate">{cat === "All" ? "All Collections" : cat}</span>
                        <span className="rounded bg-black/15 px-1.5 py-0.5 font-mono text-[0.65rem]">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Available Now */}
          <button
            type="button"
            onClick={() => setOnlyAvailable((v) => !v)}
            aria-pressed={onlyAvailable}
            className={`inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition ${
              onlyAvailable
                ? "border-accent2/45 bg-accent2/15 text-accent2"
                : "border-white/12 bg-bg1/85 text-white/75 hover:border-white/22 hover:text-white"
            }`}
          >
            <CheckCircle2 className={`h-4 w-4 ${onlyAvailable ? "text-accent2" : "text-white/40"}`} />
            Available Now
          </button>

          {/* Favorites Only */}
          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            aria-pressed={onlyFavorites}
            className={`inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition ${
              onlyFavorites
                ? "border-danger/45 bg-danger/15 text-danger"
                : "border-white/12 bg-bg1/85 text-white/75 hover:border-white/22 hover:text-white"
            }`}
          >
            <Heart className={`h-4 w-4 ${onlyFavorites ? "fill-current text-danger" : "text-white/40"}`} />
            Favorites ({favoriteIds.size})
          </button>

          {/* Sort Popover */}
          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setSortMenuOpen((v) => !v);
                setCategoryMenuOpen(false);
              }}
              className="inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-bg1/85 px-4 text-xs font-semibold text-white/80 transition hover:border-white/22 hover:text-white"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-accent/80" />
              <span>
                {sortBy === "title"
                  ? "Title (A–Z)"
                  : sortBy === "author"
                    ? "Author (A–Z)"
                    : "Most Copies"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-white/45" />
            </button>

            {sortMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[190px] rounded-2xl border border-white/14 bg-bg1/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                {(
                  [
                    { id: "title", label: "Title (A–Z)" },
                    { id: "author", label: "Author (A–Z)" },
                    { id: "available", label: "Most Copies" },
                  ] as const
                ).map((opt) => {
                  const active = sortBy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.id);
                        setSortMenuOpen(false);
                      }}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                        active
                          ? "bg-accent text-on-accent font-semibold"
                          : "text-white/75 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {active && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="ml-auto flex h-[48px] items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 text-xs text-tl lg:ml-0">
            <SlidersHorizontal className="h-3.5 w-3.5 text-accent/70" />
            <span>
              <strong className="font-semibold text-white">{filtered.length}</strong> / {books.length}
            </span>
          </div>
        </div>
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
