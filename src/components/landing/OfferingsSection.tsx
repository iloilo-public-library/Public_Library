"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface OfferingSlide {
  id: string;
  code: string;
  badge: string;
  sectionTag: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
}

const OFFERING_SLIDES: OfferingSlide[] = [
  {
    id: "study-space",
    code: "LIB-01",
    badge: "STUDY SPACE",
    sectionTag: "01",
    title: "FREE STUDY SPACE & WIFI",
    subtitle: "MAIN READING HALL · CONDUCIVE LEARNING ENVIRONMENT",
    description:
      "The library provides a quiet, comfortable space for studying, research, and remote work — complete with free high-speed WiFi connectivity for every visitor.",
    image: "/static/images/library6.png",
  },
  {
    id: "iloilo-archives",
    code: "LIB-02",
    badge: "HERITAGE ARCHIVE",
    sectionTag: "02",
    title: "ILOILO PROVINCE ARCHIVES",
    subtitle: "HISTORICAL RECORDS & CULTURAL PRESERVATION",
    description:
      "Delve into the past with our extensive collection of historical documents, photographs, and rare manuscripts preserving the rich heritage of Iloilo Province.",
    image: "/static/images/library5.png",
  },
  {
    id: "filipiniana",
    code: "LIB-03",
    badge: "SPECIAL COLLECTION",
    sectionTag: "03",
    title: "FILIPINIANA COLLECTION",
    subtitle: "PHILIPPINE CULTURE, HISTORY & LITERATURE",
    description:
      "Explore a curated collection of books and reference works about the Philippines, encompassing the nation's history, arts, society, and classic literature.",
    image: "/static/images/library8.png",
  },
  {
    id: "rizaliana",
    code: "LIB-04",
    badge: "NATIONAL HERITAGE",
    sectionTag: "04",
    title: "RIZALIANA COLLECTION",
    subtitle: "WORKS & LEGACY OF DR. JOSE RIZAL",
    description:
      "Immerse yourself in dedicated literary works, biographies, and scholarly studies honoring the life, writings, and enduring legacy of our national hero.",
    image: "/static/images/library1.png",
  },
  {
    id: "childrens-corner",
    code: "LIB-05",
    badge: "YOUTH & FAMILY",
    sectionTag: "05",
    title: "CHILDREN'S CORNER",
    subtitle: "EARLY LITERACY & STORYTELLING SPACE",
    description:
      "Nurturing the love for reading from a young age with illustrated storybooks, educational activities, and a welcoming reading corner built for young learners.",
    image: "/static/images/library4.png",
  },
  {
    id: "theses",
    code: "LIB-06",
    badge: "ACADEMIC RESEARCH",
    sectionTag: "06",
    title: "THESES & DISSERTATIONS",
    subtitle: "GRADUATE & UNDERGRADUATE RESEARCH REPOSITORY",
    description:
      "Catering to students, educators, and researchers with a comprehensive catalog of local academic studies, capstone projects, theses, and dissertations.",
    image: "/static/images/library3.png",
  },
  {
    id: "general-collection",
    code: "LIB-07",
    badge: "CIRCULATING",
    sectionTag: "07",
    title: "GENERAL COLLECTION",
    subtitle: "FICTION, NON-FICTION & REFERENCE VOLUMES",
    description:
      "Dive into thousands of books spanning science, literature, arts, technology, and contemporary fiction — ensuring there is something for every curious mind.",
    image: "/static/images/library2.png",
  },
  {
    id: "periodicals",
    code: "LIB-08",
    badge: "CURRENT AFFAIRS",
    sectionTag: "08",
    title: "MAGAZINES & NEWSPAPERS",
    subtitle: "DAILY PRESS, JOURNALS & PERIODICALS",
    description:
      "Stay informed with current local and national newspapers, educational journals, and curated magazines updated regularly in our periodicals lounge.",
    image: "/static/images/library7.png",
  },
];

const AUTO_INTERVAL_MS = 4500;

interface OfferingsSectionProps {
  catalogHref?: string;
}

export function OfferingsSection({ catalogHref = "/browse" }: OfferingsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const goTo = useCallback(
    (nextIndex: number, dir?: number) => {
      const normalized = (nextIndex + OFFERING_SLIDES.length) % OFFERING_SLIDES.length;
      setDirection(dir ?? (normalized >= index ? 1 : -1));
      setIndex(normalized);
    },
    [index]
  );

  const next = useCallback(() => goTo(index + 1, 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1, -1), [goTo, index]);

  // Pause auto-cycling when scrolled out of view or tab is hidden to eliminate background CPU/GPU work
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => setIsVisible(Boolean(entries[0]?.isIntersecting)),
      { threshold: 0.1 }
    );
    observer.observe(el);

    const onVis = () => {
      if (document.hidden) setIsVisible(false);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const activeAuto = isPlaying && !isHovered && isVisible;

  useEffect(() => {
    if (!activeAuto) return;
    const timer = window.setInterval(() => {
      setDirection(1);
      setIndex((curr) => (curr + 1) % OFFERING_SLIDES.length);
    }, AUTO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeAuto]);

  const active = OFFERING_SLIDES[index];
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section
      ref={sectionRef}
      id="offerings"
      className="border-y border-white/8 bg-[#121e2b]/85 px-5 py-16 [content-visibility:auto] md:px-10 md:py-24"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="mx-auto max-w-[1200px]">
        {/* ── TOP HEADER ROW ── */}
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1.5 font-mono text-[0.72rem] tracking-[0.14em] text-white/40 uppercase">
              LIB // 01 [COLLECTIONS]
            </div>
            <div className="mb-1 font-mono text-[0.76rem] font-semibold tracking-[0.2em] text-accent2 uppercase">
              WHAT&apos;S INSIDE
            </div>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-none tracking-[-0.03em] text-white uppercase">
              LIBRARY <span className="text-accent">OFFERINGS.</span>
            </h2>
          </div>

          <div className="pt-1 font-mono text-[0.72rem] tracking-[0.16em] text-white/40 uppercase">
            ILOILO CITY PUBLIC LIBRARY
          </div>
        </div>

        {/* ── MAIN 2-COLUMN EDITORIAL CAROUSEL ── */}
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-14">
          {/* Left: Portrait/Square Featured Photo Card */}
          <div className="relative mx-auto aspect-square w-full max-w-[400px] overflow-hidden rounded-[22px] border border-white/12 bg-bg1 shadow-[0_24px_60px_rgba(0,0,0,0.45)] lg:mx-0">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.img
                key={active.id}
                src={active.image}
                alt={active.title}
                custom={direction}
                initial={{ opacity: 0, x: direction * 40, scale: 1.04 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: direction * -40, scale: 0.97 }}
                transition={{ duration: 0.45, ease: [0.22, 0.68, 0, 1.2] }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </AnimatePresence>

            {/* Bottom Vignette + Code Stamp */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-4 left-4 z-10 font-mono text-[0.72rem] tracking-[0.12em] text-white/75 uppercase">
              ID: {active.code}
            </div>

            {/* Subtle Auto-Advance Progress Line */}
            {activeAuto && (
              <motion.div
                key={`${active.id}-${isPlaying}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: AUTO_INTERVAL_MS / 1000, ease: "linear" }}
                className="absolute inset-x-0 bottom-0 z-20 h-[3px] origin-left bg-gradient-to-r from-accent to-accent2"
              />
            )}
          </div>

          {/* Right: Active Offering Details + Controls + Thumbnail Roster */}
          <div className="flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 0.68, 0, 1.2] }}
              >
                {/* Badge + Index Tag */}
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full border border-accent/35 bg-accent/12 px-3.5 py-1 font-mono text-[0.72rem] font-bold tracking-[0.12em] text-accent uppercase">
                    {active.badge}
                  </span>
                  <span className="font-mono text-[0.76rem] text-white/40">
                    // {active.sectionTag}
                  </span>
                </div>

                {/* Big Display Title */}
                <h3 className="mb-2 text-[clamp(1.75rem,3.4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.02em] text-white uppercase">
                  {active.title}
                </h3>

                {/* Monospace Subtitle */}
                <p className="mb-5 font-mono text-[0.76rem] tracking-[0.14em] text-accent/70 uppercase">
                  {active.subtitle}
                </p>

                {/* Description */}
                <p className="mb-7 max-w-[560px] text-[0.95rem] leading-[1.7] text-tl/85">
                  {active.description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Controls Row: Prev / Next + Counter + Auto-Play Toggle */}
            <div className="mb-7 flex items-center gap-3">
              <LibraryTooltip label="Previous offering">
                <button
                  type="button"
                  onClick={prev}
                  aria-label="Previous offering"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/4 text-white/80 transition hover:border-accent/50 hover:bg-accent/15 hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </LibraryTooltip>

              <LibraryTooltip label="Next offering">
                <button
                  type="button"
                  onClick={next}
                  aria-label="Next offering"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/4 text-white/80 transition hover:border-accent/50 hover:bg-accent/15 hover:text-white cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </LibraryTooltip>

              <div className="ml-1 font-mono text-[0.82rem] tracking-[0.12em]">
                <span className="font-bold text-white">{pad(index + 1)}</span>
                <span className="mx-1.5 text-white/30">/</span>
                <span className="text-white/45">{pad(OFFERING_SLIDES.length)}</span>
              </div>

              <LibraryTooltip label={isPlaying ? "Pause auto-cycle" : "Resume auto-cycle"}>
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  aria-label={isPlaying ? "Pause auto-cycle" : "Resume auto-cycle"}
                  className="ml-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/4 text-white/60 transition hover:border-accent/40 hover:text-accent cursor-pointer"
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
              </LibraryTooltip>
            </div>

            {/* Thumbnail Roster Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[0.72rem] tracking-[0.14em] text-white/40 uppercase">
                OFFERINGS:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {OFFERING_SLIDES.map((slide, idx) => {
                  const isActive = idx === index;
                  return (
                    <LibraryTooltip key={slide.id} label={slide.title} side="bottom">
                      <button
                        type="button"
                        onClick={() => goTo(idx)}
                        aria-label={`View ${slide.title}`}
                        className={cn(
                          "relative h-11 w-11 overflow-hidden rounded-xl border transition-all duration-200 cursor-pointer",
                          isActive
                            ? "scale-105 border-accent ring-2 ring-accent/40 shadow-[0_0_18px_rgba(159,193,225,0.35)] opacity-100"
                            : "border-white/12 opacity-45 hover:opacity-90"
                        )}
                      >
                        <img
                          src={slide.image}
                          alt={slide.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    </LibraryTooltip>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM ACTION BAR ── */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/8 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={catalogHref}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 font-mono text-[0.78rem] font-bold tracking-[0.08em] text-on-accent uppercase transition hover:-translate-y-0.5 hover:bg-[#b8d4ec]"
            >
              Explore Catalog <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a
              href="#services"
              className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/4 px-6 py-2.5 font-mono text-[0.78rem] font-semibold tracking-[0.08em] text-white/85 uppercase transition hover:border-white/40 hover:bg-white/10 hover:text-white"
            >
              Services &amp; Resources
            </a>
          </div>

          <span className="font-mono text-[0.72rem] tracking-[0.16em] text-white/35 uppercase">
            DR. GRACIANO LOPEZ JAENA LRC
          </span>
        </div>
      </div>
    </section>
  );
}
