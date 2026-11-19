"use client";

import Link from "next/link";
import { BookOpen, Calendar, Hash, Layers, Lock, LogIn, User, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Book } from "@/types/library";

interface BookDetailModalProps {
  book: Book | null;
  onClose: () => void;
}

export function BookDetailModal({ book, onClose }: BookDetailModalProps) {
  return (
    <Dialog open={book !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-[680px] flex-col p-0">
        {book && (
          <>
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
              <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-bold text-accent">
                <BookOpen className="h-4 w-4" /> Book Details
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detailed catalog metadata for {book.title}
              </DialogDescription>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-white/60 transition hover:bg-danger/15 hover:text-danger cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col gap-6 sm:flex-row">
                {/* Cover */}
                <div className="mx-auto w-[150px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-bg1 sm:mx-0">
                  {book.thumbnail_url ? (
                    <img
                      src={book.thumbnail_url}
                      alt={book.title}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 p-3 text-center">
                      <BookOpen className="h-8 w-8 text-accent/40" />
                      <span className="text-[0.72rem] text-white/50">No Cover</span>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex-1 space-y-3">
                  <div>
                    <h2 className="text-[1.2rem] font-bold leading-snug text-white">
                      {book.title}
                    </h2>
                    {book.subtitle && (
                      <p className="mt-0.5 text-[0.84rem] text-tl/75">{book.subtitle}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-[0.75rem]">
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-3 py-0.5 font-semibold text-accent">
                      <User className="h-3 w-3" /> {book.author || "Unknown Author"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/6 px-3 py-0.5 text-white/75">
                      <Layers className="h-3 w-3" /> {book.category || book.genre || "General"}
                    </span>
                    {!book.is_borrowable ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warn/30 bg-warn/15 px-3 py-0.5 font-semibold text-warn">
                        <Lock className="h-3 w-3" /> In-Library Use Only
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 font-semibold ${
                          book.available_copies > 0
                            ? "border-accent2/30 bg-accent2/15 text-accent2"
                            : "border-danger/30 bg-danger/15 text-danger"
                        }`}
                      >
                        {book.available_copies} / {book.total_copies} Copies Available
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-white/8 bg-white/4 p-3.5 text-[0.78rem]">
                    <div>
                      <span className="block text-[0.68rem] uppercase tracking-wider text-white/40">
                        Call Number
                      </span>
                      <span className="font-mono font-medium text-white">
                        {book.call_number || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[0.68rem] uppercase tracking-wider text-white/40">
                        ISBN
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-white">
                        <Hash className="h-3 w-3 text-accent/60" /> {book.isbn || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[0.68rem] uppercase tracking-wider text-white/40">
                        Publisher
                      </span>
                      <span className="text-white/85">{book.publisher || "—"}</span>
                    </div>
                    <div>
                      <span className="block text-[0.68rem] uppercase tracking-wider text-white/40">
                        Published / Copyright
                      </span>
                      <span className="inline-flex items-center gap-1 text-white/85">
                        <Calendar className="h-3 w-3 text-accent/60" />{" "}
                        {book.published_date || book.copy_right || "—"}
                      </span>
                    </div>
                  </div>

                  {book.description && (
                    <div>
                      <span className="mb-1 block text-[0.72rem] font-bold uppercase tracking-wider text-white/45">
                        Description
                      </span>
                      <p className="text-[0.82rem] leading-relaxed text-tl/80">
                        {book.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/8 px-6 py-4">
              <span className="text-[0.76rem] text-white/45">
                Log in as a registered member to bookmark or check borrowing status.
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Close
                </Button>
                <Button variant="accent" size="sm" asChild>
                  <Link href="/login">
                    <LogIn className="h-3.5 w-3.5" /> Member Login
                  </Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
