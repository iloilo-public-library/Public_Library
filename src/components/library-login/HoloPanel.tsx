"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { CardPhase } from "@/components/auth/useBookFlip";

/*
 * Baybayin script verification (Unicode Tagalog block U+1700–U+171F):
 * - ᜁᜎᜓᜁᜎᜓ = "Iloilo"
 */
const BAYBAYIN_ILOILO = "ᜁᜎᜓᜁᜎᜓ";

interface HoloPanelProps {
  cardPhase: CardPhase;
  interactive: boolean;
  announcement: string;
  activeKey: string;
  children: ReactNode;
}

function FrameCorner({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 h-6 w-6 text-[#f5cf7a]/80 ${className}`}
    >
      <path
        d="M3 30 V9 Q3 3 9 3 H30 M9 23 V12 Q9 9 12 9 H23"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="9" cy="9" r="1.8" fill="#f5cf7a" opacity="0.85" />
    </svg>
  );
}

/**
 * Translucent hologram card kept OUTSIDE the book's preserve-3d context so
 * backdrop-filter and text rendering stay sharp.
 * - Dematerializes top-down (--card-out) and materializes bottom-up (--card-in)
 * - Disables interaction during invisible phase, restores focus once visible
 * - Announces form transitions via a polite aria-live region
 */
export function HoloPanel({
  cardPhase,
  interactive,
  announcement,
  activeKey,
  children,
}: HoloPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const lastFocusedKeyRef = useRef<string>(activeKey);

  // Move focus to the first input or heading after a form switch finishes materializing
  useEffect(() => {
    if (cardPhase !== "visible" || !interactive) return;
    if (lastFocusedKeyRef.current === activeKey) return;
    lastFocusedKeyRef.current = activeKey;

    const container = contentRef.current;
    if (!container) return;
    const focusTarget = container.querySelector<HTMLElement>(
      "input:not([disabled]), button:not([disabled]), h2"
    );
    if (focusTarget) {
      if (focusTarget.tagName === "H2" && !focusTarget.hasAttribute("tabindex")) {
        focusTarget.setAttribute("tabindex", "-1");
      }
      focusTarget.focus({ preventScroll: true });
    }
  }, [activeKey, cardPhase, interactive]);

  return (
    <div
      id="ilpl-panel-auth"
      className="ilpl-holo-anchor"
      data-phase={cardPhase}
      aria-busy={!interactive}
    >
      {/* Polite screen-reader announcement for form / step switches */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div
        className="ilpl-holo-card"
        style={{ pointerEvents: interactive ? "auto" : "none" }}
      >
        <div className="ilpl-holo-glass" aria-hidden="true" />
        <div className="ilpl-holo-scanlines" aria-hidden="true" />
        <div className="ilpl-holo-pulse-ring" aria-hidden="true" />

        <FrameCorner className="left-2 top-2" />
        <FrameCorner className="right-2 top-2 scale-x-[-1]" />
        <FrameCorner className="bottom-2 left-2 scale-y-[-1]" />
        <FrameCorner className="bottom-2 right-2 scale-[-1]" />

        <div
          aria-hidden="true"
          className="pointer-events-none relative z-10 mb-1.5 flex items-center justify-center gap-3 text-[0.7rem] tracking-[0.22em] text-[#f5cf7a]/80"
        >
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#f5cf7a]/55" />
          <span className="ilpl-baybayin">{BAYBAYIN_ILOILO}</span>
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#f5cf7a]/55" />
        </div>

        <div ref={contentRef} className="ilpl-holo-content">
          {children}
        </div>
      </div>
    </div>
  );
}
