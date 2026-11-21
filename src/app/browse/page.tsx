"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  ArrowUpDown,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
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
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sortBy, setSortBy] = useState<"title" | "author" | "available">("title");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
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

  const { data, error, isLoading, mutate } = useSWR<BooksApiResponse>(
    "/api/public/books",
    swrPublicConfig
  );

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

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = books.filter((b) => {
      const cat = (b.category || b.genre || "").trim();
      if (selectedCategory !== "All" && cat !== selectedCategory) return false;
      if (onlyAvailable && !(b.is_borrowable && b.available_copies > 0)) return false;
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
      if (sortBy === "available") {
        return (b.available_copies || 0) - (a.available_copies || 0);
      }
      if (sortBy === "author") {
        return (a.author || "").localeCompare(b.author || "");
      }
      return (a.title || "").localeCompare(b.title || "");
    });
  }, [books, query, selectedCategory, onlyAvailable, sortBy]);

  const hasActiveFilters = query.trim() !== "" || selectedCategory !== "All" || onlyAvailable;

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pagedBooks = filteredBooks.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <div className="min-h-screen">
      <PublicTopbar onOpenMemberModal={() => setMemberModalOpen(true)} activePath="/browse" />

      <main className="mx-auto max-w-[1360px] px-4 pb-16 pt-[92px] md:px-10">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-accent">
              <BookOpen className="h-3.5 w-3.5" /> Public Catalog
            </div>
            <h1 className="text-[1.95rem] font-bold tracking-[-0.03em] text-white">
              Browse <span className="text-accent">Library Collection</span>
            </h1>
            <p className="mt-1 text-[0.86rem] text-tl">
              Explore {books.length.toLocaleString()} cataloged titles with live availability.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedCategory("All");
                  setOnlyAvailable(false);
                  setPage(1);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-tl transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                Reset filters
              </button>
            )}
            <LibraryTooltip label="Refresh catalog cache">
              <Button variant="secondary" size="sm" onClick={() => mutate()}>
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </LibraryTooltip>
          </div>
        </div>

        {/* Unified Single-Row Search & Filter Command Bar (No Clipped Horizontal Ribbon) */}
        <div className="mb-8 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Elevated Pill Search Input */}
            <div className="group relative flex-1">
              <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-accent/20 via-accent2/10 to-accent/20 opacity-0 blur transition duration-300 group-focus-within:opacity-100" />
              <div className="relative flex h-[48px] items-center rounded-2xl border border-white/12 bg-bg1/90 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-200 focus-within:border-accent/50 focus-within:bg-bg1">
                <Search className="h-4.5 w-4.5 shrink-0 text-accent/80 transition-transform duration-200 group-focus-within:scale-110" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search titles, authors, ISBN, call number, or subject..."
                  className="w-full bg-transparent py-2 pl-3 pr-3 text-[0.92rem] text-white placeholder:text-white/38 focus:outline-none"
                />

                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setPage(1);
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

            {/* Filter Controls: Collection Popover + Available Now + Sort Popover + Count */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Collection Popover Dropdown */}
              <div ref={categoryMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryMenuOpen((v) => !v);
                    setSortMenuOpen(false);
                  }}
                  aria-expanded={categoryMenuOpen}
                  className={`inline-flex h-[48px] cursor-pointer items-center gap-2.5 rounded-2xl border px-4 text-xs font-semibold transition-all ${
                    selectedCategory !== "All"
                      ? "border-accent/45 bg-accent/15 text-accent shadow-[0_0_20px_rgba(147,197,253,0.14)]"
                      : "border-white/12 bg-bg1/85 text-white/80 hover:border-white/22 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Layers className="h-4 w-4 text-accent/80" />
                  <span className="text-white/45">Collection:</span>
                  <span className="max-w-[160px] truncate text-white">
                    {selectedCategory === "All" ? "All Subjects" : selectedCategory}
                  </span>
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.66rem] text-white/75">
                    {selectedCategory === "All"
                      ? books.length
                      : (categoryCounts.get(selectedCategory) ?? 0)}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-white/45 transition-transform duration-200 ${
                      categoryMenuOpen ? "rotate-180 text-accent" : ""
                    }`}
                  />
                </button>

                {categoryMenuOpen && (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[320px] sm:w-[440px] rounded-2xl border border-white/14 bg-bg1/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                    <div className="mb-2.5 flex items-center justify-between px-1.5">
                      <span className="text-[0.7rem] font-bold uppercase tracking-wider text-white/45">
                        Filter by Collection ({categories.length - 1} subjects)
                      </span>
                      {selectedCategory !== "All" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory("All");
                            setCategoryMenuOpen(false);
                            setPage(1);
                          }}
                          className="cursor-pointer text-[0.72rem] font-semibold text-accent hover:underline"
                        >
                          Show All
                        </button>
                      )}
                    </div>

                    <div className="grid max-h-[300px] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
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
                              setPage(1);
                            }}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition ${
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
                                active ? "bg-black/20 text-on-accent" : "bg-white/8 text-white/50"
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

              {/* Available Now Toggle */}
              <button
                type="button"
                onClick={() => {
                  setOnlyAvailable((v) => !v);
                  setPage(1);
                }}
                aria-pressed={onlyAvailable}
                className={`inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition-all ${
                  onlyAvailable
                    ? "border-accent2/45 bg-accent2/15 text-accent2 shadow-[0_0_20px_rgba(125,212,168,0.12)]"
                    : "border-white/12 bg-bg1/85 text-white/75 hover:border-white/22 hover:bg-white/8 hover:text-white"
                }`}
              >
                <CheckCircle2
                  className={`h-4 w-4 ${onlyAvailable ? "text-accent2" : "text-white/40"}`}
                />
                Available Now
              </button>

              {/* Custom Sort Popover */}
              <div ref={sortMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setSortMenuOpen((v) => !v);
                    setCategoryMenuOpen(false);
                  }}
                  aria-expanded={sortMenuOpen}
                  className="inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-bg1/85 px-4 text-xs font-semibold text-white/80 transition hover:border-white/22 hover:bg-white/8 hover:text-white"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 text-accent/80" />
                  <span className="text-white/45">Sort:</span>
                  <span className="text-white">
                    {sortBy === "title"
                      ? "Title (A–Z)"
                      : sortBy === "author"
                        ? "Author (A–Z)"
                        : "Most Copies"}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-white/45 transition-transform duration-200 ${
                      sortMenuOpen ? "rotate-180 text-accent" : ""
                    }`}
                  />
                </button>

                {sortMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[200px] rounded-2xl border border-white/14 bg-bg1/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
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
                            setPage(1);
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

              {/* Results Counter Pill */}
              <div className="ml-auto flex h-[48px] items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 text-xs text-tl lg:ml-0">
                <SlidersHorizontal className="h-3.5 w-3.5 text-accent/70" />
                <span>
                  <strong className="font-semibold text-white">{filteredBooks.length}</strong> /{" "}
                  {books.length}
                </span>
              </div>
            </div>
          </div>

          {/* Active Filter Dismissal Chips (only shown when a filter is applied) */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-[0.72rem] font-semibold uppercase tracking-wider text-white/40">
                Active filters:
              </span>
              {selectedCategory !== "All" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("All");
                    setPage(1);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent transition hover:bg-accent/20"
                >
                  <span>Collection: {selectedCategory}</span>
                  <X className="h-3 w-3" />
                </button>
              )}
              {onlyAvailable && (
                <button
                  type="button"
                  onClick={() => {
                    setOnlyAvailable(false);
                    setPage(1);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-accent2/30 bg-accent2/12 px-2.5 py-1 text-xs font-semibold text-accent2 transition hover:bg-accent2/20"
                >
                  <span>Available Now</span>
                  <X className="h-3 w-3" />
                </button>
              )}
              {query.trim() !== "" && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-2.5 py-1 text-xs font-semibold text-white/85 transition hover:bg-white/14"
                >
                  <span>Search: &ldquo;{query.trim()}&rdquo;</span>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
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
