"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Building2,
  MousePointerClick,
  RotateCcw,
  X,
} from "lucide-react";
import type { ShelfItem } from "@/components/BookShelf";
import { cn } from "@/lib/utils";

const BookShelfHeroCanvas = dynamic(
  () =>
    import("@/components/landing/BookShelfHeroCanvas").then(
      (mod) => mod.BookShelfHeroCanvas
    ),
  { ssr: false }
);

const ITEMS: ShelfItem[] = [
  {
    id: "offerings",
    title: "Library Offerings",
    blurb: "Free study spaces with WiFi, special collections, children's corner, and periodicals.",
  },
  {
    id: "features",
    title: "Features",
    blurb: "Unified catalog search, member book borrowing, local archives, and community events.",
  },
  {
    id: "Vission_and_Mission",
    title: "Vision & Mission",
    blurb: "Guided by Republic Act No. 7743 to empower Ilonggos through lifelong learning.",
  },
  {
    id: "services",
    title: "Services & Resources",
    blurb: "Readers' services, literacy outreach drives, and provincial archival preservation.",
  },
  {
    id: "browse",
    title: "Explore Books",
    blurb: "Browse thousands of cataloged titles with live copy availability and call numbers.",
  },
  {
    id: "heritage",
    title: "Heritage",
    blurb: "Rare historical manuscripts, documents, and cultural records of Iloilo Province.",
  },
  {
    id: "museum",
    title: "Museum",
    blurb: "Dr. Graciano Lopez Jaena Learning Resource Center and Museum exhibits and heritage.",
  },
  {
    id: "no_user_about",
    title: "About Us",
    blurb: "Library hours, Jaro location, contact details, and public service mandate.",
  },
];

const HERO_EASE = [0.22, 0.68, 0, 1] as const;

export interface BookHeroProps {
  eyebrow: string;
  headlineTop: string;
  headlineAccent: string;
  description: string;
  primaryCta: {
    href: string;
    label: string;
  };
  secondaryCta: {
    href: string;
    label: string;
    icon?: ReactNode;
  };
}

export function BookHero({
  eyebrow,
  headlineTop,
  headlineAccent,
  description,
  primaryCta,
  secondaryCta,
}: BookHeroProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectedItem = useMemo(
    () => ITEMS.find((item) => item.id === selected) ?? null,
    [selected]
  );

  const handleOpenSection = useCallback(
    (item: ShelfItem) => {
      if (item.id === "browse") {
        router.push(primaryCta.href);
        return;
      }
      if (item.id === "no_user_about") {
        router.push("/no_user_about");
        return;
      }

      const fallbackId =
        item.id === "heritage"
          ? "services"
          : item.id === "museum"
            ? "offerings"
            : item.id;

      const el =
        document.getElementById(item.id) || document.getElementById(fallbackId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [primaryCta.href, router]
  );

  return (
    <section className="hero-preserve-dark relative flex min-h-screen flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_68%_45%,#283b4f_0%,#1a2837_60%,#121e2b_100%)] pt-[60px] md:justify-center">
      {/* Left gradient scrim on desktop for contrast over the 3D scene */}
      <div className="pointer-events-none hidden md:block md:absolute md:inset-0 md:z-[2] md:bg-[linear-gradient(to_right,rgba(15,25,36,0.92)_0%,rgba(15,25,36,0.68)_42%,rgba(15,25,36,0.18)_72%,transparent_100%)]" />

      {/* Real DOM Hero Content (Stacked above canvas on < 768px, overlaid left on >= 768px) */}
      <div className="relative z-[3] w-full max-w-[650px] px-6 pb-4 pt-8 md:px-[60px] md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: HERO_EASE }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-4 py-1.5 text-[0.75rem] font-bold uppercase tracking-[0.09em] text-accent shadow-[0_4px_20px_rgba(0,0,0,0.25)] backdrop-blur-md"
        >
          <Building2 className="h-3.5 w-3.5" />
          {eyebrow}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.14, ease: HERO_EASE }}
          className="mb-4 text-[clamp(2.15rem,4.6vw,3.5rem)] font-bold leading-[1.08] tracking-[-0.03em] text-white drop-shadow-[0_6px_28px_rgba(0,0,0,0.55)]"
        >
          {headlineTop}
          <br />
          <span className="bg-gradient-to-r from-white via-accent to-[#7dd3fc] bg-clip-text text-transparent">
            {headlineAccent}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.22, ease: HERO_EASE }}
          className="mb-7 max-w-[460px] text-[1rem] leading-[1.7] text-tl/90 drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]"
        >
          {description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3, ease: HERO_EASE }}
          className="mb-7 flex flex-wrap gap-3.5"
        >
          <Link
            href={primaryCta.href}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-[0.92rem] font-bold text-on-accent shadow-[0_8px_28px_rgba(159,193,225,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#b8d4ec]"
          >
            <BookOpen className="h-4 w-4" /> {primaryCta.label}
          </Link>
          <a
            href={secondaryCta.href}
            className="inline-flex items-center gap-2 rounded-xl border border-white/28 bg-white/6 px-[22px] py-[11px] text-[0.92rem] font-semibold text-white backdrop-blur-md transition duration-200 hover:border-white/55 hover:bg-white/12"
          >
            {secondaryCta.icon}
            {secondaryCta.label}
          </a>
        </motion.div>

        {/* Accessible Keyboard & Screen-Reader Shelf Selector Buttons */}
        <div
          role="group"
          aria-label="Interactive library bookshelf volumes"
          className="flex flex-wrap gap-1.5"
        >
          {ITEMS.map((item) => {
            const active = selected === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(item.id)}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-[0.7rem] font-semibold transition cursor-pointer",
                  active
                    ? "border-accent bg-accent text-on-accent shadow-[0_4px_16px_rgba(159,193,225,0.3)]"
                    : "border-white/16 bg-bg1/70 text-white/75 backdrop-blur-sm hover:border-accent/45 hover:text-white"
                )}
              >
                {item.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Book Real DOM Info Card */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            key={selectedItem.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            role="region"
            aria-label={selectedItem.title}
            className="relative z-[4] mx-6 mb-4 rounded-2xl border border-accent/30 bg-[#142230]/92 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl md:absolute md:bottom-16 md:right-10 md:mx-0 md:mb-0 md:w-[360px]"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-[0.66rem] font-bold tracking-[0.14em] text-accent2 uppercase">
                  SHELF VOLUME
                </span>
                <h2 className="mt-0.5 text-[1.08rem] font-bold text-white">
                  {selectedItem.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Put back"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/6 text-white/65 transition hover:bg-white/14 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {selectedItem.blurb && (
              <p className="mb-4 text-[0.83rem] leading-relaxed text-tl/85">
                {selectedItem.blurb}
              </p>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenSection(selectedItem)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[0.82rem] font-bold text-on-accent transition hover:bg-[#b8d4ec] cursor-pointer"
              >
                Open section <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/18 bg-white/6 px-3.5 py-2 text-[0.82rem] font-semibold text-white/85 transition hover:border-white/35 hover:bg-white/12 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Put back
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive 3D Bookshelf Canvas (60vh stacked on <768px, full hero behind/right on >=768px) */}
      <div className="relative z-[1] w-full md:static">
        <BookShelfHeroCanvas
          items={ITEMS}
          selected={selected}
          setSelected={setSelected}
        />
      </div>

      {/* Bottom-right Interaction Hint */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-[4] inline-flex items-center gap-2 rounded-full border border-accent/22 bg-bg1/75 px-4 py-1.5 text-[0.74rem] font-semibold tracking-[0.03em] text-accent/80 backdrop-blur-md md:bottom-6 md:right-10">
        <MousePointerClick className="h-3.5 w-3.5" /> Hover a book, click to pull it out
      </div>
    </section>
  );
}
