"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Lock } from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import type { Book } from "@/types/library";

interface BookCardProps {
  book: Book;
  onSelect: (book: Book) => void;
}

export function BookCard({ book, onSelect }: BookCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const isAvailable = book.available_copies > 0;
  const coverSrc = !imgFailed ? book.thumbnail_url || "" : "";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.22 }}
      onClick={() => onSelect(book)}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/8 bg-card-glass backdrop-blur-sm transition-colors hover:border-accent/30 hover:bg-card-glass-hover hover:shadow-[0_14px_36px_rgba(0,0,0,0.28)]"
    >
      {/* Cover */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-bg1/80">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={book.title}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 bg-gradient-to-br from-bg2 via-bg1 to-bg3 p-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10">
              <BookOpen className="h-6 w-6 text-accent/70" />
            </div>
            <span className="line-clamp-3 text-xs font-semibold leading-relaxed text-white/80">
              {book.title || "Untitled Book"}
            </span>
            <span className="line-clamp-1 text-[0.68rem] text-tl/65">
              {book.author || "Iloilo City Public Library"}
            </span>
          </div>
        )}

        {/* Availability Pill */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold backdrop-blur-md ${
              !book.is_borrowable
                ? "border border-warn/30 bg-warn/20 text-warn"
                : isAvailable
                  ? "border border-accent2/35 bg-accent2/20 text-accent2"
                  : "border border-danger/35 bg-danger/20 text-danger"
            }`}
          >
            {!book.is_borrowable
              ? "In-Library"
              : isAvailable
                ? `${book.available_copies} Avail`
                : "Borrowed"}
          </span>
        </div>

        {!book.is_borrowable && (
          <LibraryTooltip label="Non-circulating (In-library use only)">
            <div className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-bg1/85 text-gold">
              <Lock className="h-3 w-3" />
            </div>
          </LibraryTooltip>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3.5">
        <LibraryTooltip label={book.title}>
          <h3 className="mb-1 line-clamp-2 text-[0.86rem] font-bold leading-snug text-white group-hover:text-accent">
            {book.title || "Untitled"}
          </h3>
        </LibraryTooltip>
        <p className="mb-2 line-clamp-1 text-[0.76rem] text-tl/75">
          {book.author || "Unknown Author"}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/6 pt-2.5 text-[0.68rem]">
          <span className="truncate rounded-md bg-accent/10 px-2 py-0.5 font-medium text-accent">
            {book.category || book.genre || "General"}
          </span>
          {book.call_number && (
            <span className="shrink-0 font-mono text-white/45">{book.call_number}</span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
