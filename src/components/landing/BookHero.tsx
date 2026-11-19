"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  MousePointerClick,
} from "lucide-react";
import type { TableItem } from "@/components/EnchantTable";
import { cn } from "@/lib/utils";

const EnchantTableHeroCanvas = dynamic(
  () =>
    import("@/components/landing/EnchantTableHeroCanvas").then(
      (mod) => mod.EnchantTableHeroCanvas
    ),
  { ssr: false }
);

const ITEMS: TableItem[] = [
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
  const [spread, setSpreadState] = useState(0);

  const setSpread = useCallback((n: number) => {
    const clamped = Math.max(0, Math.min(ITEMS.length - 1, n));
    setSpreadState(clamped);
  }, []);

  // Keyboard support: ArrowLeft / ArrowRight turns pages
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") {
        setSpreadState((prev) => Math.min(ITEMS.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft") {
        setSpreadState((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Automatically flip pages every 4.5s (paused when user prefers reduced motion)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const timer = window.setInterval(() => {
      setSpreadState((prev) => (prev + 1) % ITEMS.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [spread]);

  const currentItem = ITEMS[spread] ?? ITEMS[0];

  const handleOpenSection = useCallback(
    (item: TableItem) => {
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

      const targetEl =
        document.getElementById(item.id) || document.getElementById(fallbackId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [primaryCta.href, router]
  );

  return (
    <section className="hero-preserve-dark relative flex min-h-screen flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_68%_45%,#283b4f_0%,#1a2837_60%,#121e2b_100%)] pt-[60px] md:justify-center">
      {/* Left gradient scrim on desktop for contrast over the 3D scene */}
      <div className="pointer-events-none hidden md:block md:absolute md:inset-0 md:z-[2] md:bg-[linear-gradient(to_right,rgba(15,25,36,0.92)_0%,rgba(15,25,36,0.68)_42%,rgba(15,25,36,0.16)_72%,transparent_100%)]" />

      {/* Real DOM Hero Content */}
      <div className="relative z-[3] w-full max-w-[650px] px-6 pb-2 pt-6 md:px-[60px] md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: HERO_EASE }}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-4 py-1.5 text-[0.75rem] font-bold uppercase tracking-[0.09em] text-accent shadow-[0_4px_20px_rgba(0,0,0,0.25)] backdrop-blur-md"
        >
          <Building2 className="h-3.5 w-3.5" />
          {eyebrow}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.14, ease: HERO_EASE }}
          className="mb-3 text-[clamp(2rem,4.4vw,3.4rem)] font-bold leading-[1.08] tracking-[-0.03em] text-white drop-shadow-[0_6px_28px_rgba(0,0,0,0.55)]"
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
          className="mb-5 max-w-[460px] text-[0.95rem] leading-[1.65] text-tl/90 drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]"
        >
          {description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3, ease: HERO_EASE }}
          className="mb-5 flex flex-wrap gap-3"
        >
          <Link
            href={primaryCta.href}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[0.9rem] font-bold text-on-accent shadow-[0_8px_28px_rgba(159,193,225,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#b8d4ec]"
          >
            <BookOpen className="h-4 w-4" /> {primaryCta.label}
          </Link>
          <a
            href={secondaryCta.href}
            className="inline-flex items-center gap-2 rounded-xl border border-white/28 bg-white/6 px-5 py-2.5 text-[0.9rem] font-semibold text-white backdrop-blur-md transition duration-200 hover:border-white/55 hover:bg-white/12"
          >
            {secondaryCta.icon}
            {secondaryCta.label}
          </a>
        </motion.div>

        {/* Accessible Section Spread Buttons */}
        <div
          role="group"
          aria-label="Open library guide sections"
          className="mb-4 flex flex-wrap gap-1.5"
        >
          {ITEMS.map((item, idx) => {
            const active = spread === idx;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSpread(idx)}
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

        {/* Active Page Spread Summary & Open Section CTA */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-[#121e2b]/82 px-4 py-3 backdrop-blur-md max-w-[520px]">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[0.65rem] font-bold tracking-[0.12em] text-accent2 uppercase">
              Page {spread + 1} of {ITEMS.length} · {currentItem.title}
            </div>
            <p className="mt-0.5 truncate text-[0.8rem] text-tl/85">
              {currentItem.blurb}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous page"
              disabled={spread === 0}
              onClick={() => setSpread(spread - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/6 text-white/75 transition hover:border-accent/45 hover:text-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={spread === ITEMS.length - 1}
              onClick={() => setSpread(spread + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/6 text-white/75 transition hover:border-accent/45 hover:text-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleOpenSection(currentItem)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[0.78rem] font-bold text-on-accent transition hover:bg-[#b8d4ec] cursor-pointer"
            >
              Open section <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive 3D Library Reading Table & Book Canvas */}
      <div className="relative z-[1] w-full md:static">
        <EnchantTableHeroCanvas
          items={ITEMS}
          spread={spread}
          onSpreadChange={setSpread}
        />
      </div>

      {/* Bottom-right Interaction Hint */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-[4] inline-flex items-center gap-2 rounded-full border border-accent/22 bg-bg1/75 px-4 py-1.5 text-[0.74rem] font-semibold tracking-[0.03em] text-accent/80 backdrop-blur-md md:bottom-6 md:right-10">
        <MousePointerClick className="h-3.5 w-3.5" /> Click the book to turn pages
      </div>
    </section>
  );
}
