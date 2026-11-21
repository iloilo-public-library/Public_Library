"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface CarouselSlide {
  src: string;
  alt: string;
  caption: string;
}

export const LIBRARY_OFFERING_SLIDES: CarouselSlide[] = [
  { src: "/images/library1.png", alt: "Library collection", caption: "Library Collection" },
  { src: "/images/library2.png", alt: "Book shelves", caption: "Book Shelves" },
  { src: "/images/library3.png", alt: "Reading area", caption: "Reading Area" },
  { src: "/images/library4.png", alt: "Children's corner", caption: "Children's Corner" },
  { src: "/images/library5.png", alt: "Archive materials", caption: "Archive Materials" },
  { src: "/images/library6.png", alt: "Study space", caption: "Study Space" },
  { src: "/images/library7.png", alt: "Periodicals", caption: "Magazines & Periodicals" },
  {
    src: "/images/library8.png",
    alt: "Philippine history books",
    caption: "Filipiniana & History",
  },
  { src: "/images/library9.png", alt: "General collection", caption: "General Collection" },
  { src: "/images/library10.png", alt: "Library interior", caption: "Library Interior" },
  { src: "/images/library11.jpg", alt: "Historical archives", caption: "Historical Archives" },
  { src: "/images/library12.jpg", alt: "Special collections", caption: "Special Collections" },
];

const AUTO_INTERVAL_MS = 4000;

interface OfferingsCarouselProps {
  slides?: CarouselSlide[];
  intervalMs?: number;
}

export function OfferingsCarousel({
  slides = LIBRARY_OFFERING_SLIDES,
  intervalMs = AUTO_INTERVAL_MS,
}: OfferingsCarouselProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPausedByHover, setIsPausedByHover] = useState(false);

  const goTo = useCallback(
    (nextIndex: number, dir?: number) => {
      const normalized = (nextIndex + slides.length) % slides.length;
      setDirection(dir ?? (normalized >= index ? 1 : -1));
      setIndex(normalized);
    },
    [index, slides.length]
  );

  const next = useCallback(() => goTo(index + 1, 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1, -1), [goTo, index]);

  const activeAuto = isPlaying && !isPausedByHover;

  useEffect(() => {
    if (!activeAuto) return;
    const timer = window.setInterval(() => {
      setDirection(1);
      setIndex((curr) => (curr + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [activeAuto, intervalMs, slides.length]);

  const current = slides[index];

  return (
    <div
      className="flex flex-col gap-3"
      onMouseEnter={() => setIsPausedByHover(true)}
      onMouseLeave={() => setIsPausedByHover(false)}
    >
      {/* Main Carousel Viewport */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px] border border-white/10 bg-bg1/80 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={current.src}
            src={current.src}
            alt={current.alt}
            custom={direction}
            initial={{ opacity: 0, x: direction * 48, scale: 1.03 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction * -48, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.22, 0.68, 0, 1.2] }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>

        {/* Bottom gradient for readability */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

        {/* Top-right Controls (Play/Pause + Counter) */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <span className="rounded-full border border-white/12 bg-bg1/75 px-2.5 py-1 font-mono text-[0.7rem] font-semibold text-accent backdrop-blur-md">
            {index + 1} / {slides.length}
          </span>

          <LibraryTooltip label={isPlaying ? "Pause slideshow" : "Play slideshow"}>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-bg1/75 text-white/85 backdrop-blur-md transition hover:border-accent/40 hover:bg-bg1 hover:text-accent cursor-pointer"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          </LibraryTooltip>
        </div>

        {/* Left / Right Arrows */}
        <LibraryTooltip label="Previous photo" side="right">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-bg1/70 text-white backdrop-blur-md transition hover:border-accent/40 hover:bg-bg1 hover:text-accent cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </LibraryTooltip>

        <LibraryTooltip label="Next photo" side="left">
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-bg1/70 text-white backdrop-blur-md transition hover:border-accent/40 hover:bg-bg1 hover:text-accent cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </LibraryTooltip>

        {/* Caption & Dots */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 px-4 pb-4">
          <div>
            <span className="inline-block rounded-full border border-accent/25 bg-bg1/75 px-3 py-1 text-[0.78rem] font-semibold text-white backdrop-blur-md">
              {current.caption}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {slides.map((slide, idx) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => goTo(idx)}
                aria-label={`View ${slide.caption}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                  idx === index ? "w-5 bg-accent" : "w-1.5 bg-white/40 hover:bg-white/75"
                )}
              />
            ))}
          </div>
        </div>

        {/* Auto-advance Progress Bar */}
        {activeAuto && (
          <motion.div
            key={`${index}-${isPlaying}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: intervalMs / 1000, ease: "linear" }}
            className="absolute inset-x-0 bottom-0 z-20 h-[3px] origin-left bg-gradient-to-r from-accent to-accent2"
          />
        )}
      </div>

      {/* Compact Thumbnail Strip */}
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-6">
        {slides.map((slide, idx) => (
          <LibraryTooltip key={slide.src} label={slide.caption} side="bottom">
            <button
              type="button"
              onClick={() => goTo(idx)}
              aria-label={`Select ${slide.caption}`}
              className={cn(
                "relative h-12 overflow-hidden rounded-lg border transition duration-200 cursor-pointer",
                idx === index
                  ? "border-accent ring-2 ring-accent/35 opacity-100"
                  : "border-white/10 opacity-55 hover:opacity-90"
              )}
            >
              <img
                src={slide.src}
                alt={slide.alt}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          </LibraryTooltip>
        ))}
      </div>
    </div>
  );
}
