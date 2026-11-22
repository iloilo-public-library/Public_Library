"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CoverSparkles } from "./LightParticles";

/*
 * Baybayin script verification (Unicode Tagalog block U+1700–U+171F):
 * - ᜁᜎᜓᜁᜎᜓ = "Iloilo" (i-lo-i-lo)
 */
const BAYBAYIN_ILOILO = "ᜁᜎᜓᜁᜎᜓ";

interface BookCoverProps {
  isClosed: boolean;
  targetMode: "login" | "signup";
}

function CornerClasp({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={`pointer-events-none absolute h-8 w-8 text-[#f5cf7a]/85 ${className}`}
    >
      <path
        d="M3 37 V10 Q3 3 10 3 H37 M9 31 V14 Q9 9 14 9 H31"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="9" cy="9" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function BookCover({ isClosed, targetMode }: BookCoverProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      role="img"
      aria-label="Baybayin: Iloilo"
      aria-hidden={!isClosed}
      className="ilpl-cover"
      initial={false}
      animate={
        prefersReducedMotion
          ? {
              opacity: isClosed ? 1 : 0,
              pointerEvents: isClosed ? "auto" : "none",
            }
          : {
              rotateY: isClosed ? 0 : -118,
              opacity: isClosed ? 1 : 0,
              pointerEvents: isClosed ? "auto" : "none",
            }
      }
      transition={{
        duration: prefersReducedMotion ? 0.2 : isClosed ? 0.52 : 0.88,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {isClosed && <div className="ilpl-cover-shimmer" aria-hidden="true" />}

      <CornerClasp className="left-3 top-3" />
      <CornerClasp className="right-3 top-3 scale-x-[-1]" />
      <CornerClasp className="bottom-3 left-3 scale-y-[-1]" />
      <CornerClasp className="bottom-3 right-3 scale-[-1]" />

      <CoverSparkles active={isClosed} count={10} />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#f5cf7a]/65 bg-[#1c2a3a]/90 shadow-[0_0_24px_rgba(245,207,122,0.28)]">
          <img
            src="/images/logo.png"
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        </div>

        {/* Large gold Baybayin title: Iloilo */}
        <p
          aria-hidden="true"
          className="ilpl-baybayin mt-3 text-3xl leading-none tracking-[0.08em] text-[#f5cf7a] drop-shadow-[0_0_12px_rgba(245,207,122,0.45)]"
        >
          {BAYBAYIN_ILOILO}
        </p>

        <p
          style={{ fontFamily: "var(--font-serif)" }}
          className="mt-2 text-base font-bold tracking-wide text-[#f5cf7a]"
        >
          The Chronicles of Iloilo
        </p>
        <p className="mt-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-[#9fc3ea]/90">
          ILOILO CITY PUBLIC LIBRARY
        </p>
        <p className="mt-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-[#9fc3ea]/70">
          {targetMode === "signup" ? "Opening Patron Registry" : "Opening Library Portal"}
        </p>
      </div>
    </motion.div>
  );
}
