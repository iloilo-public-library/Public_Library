"use client";

import type { BookMode, FlipDirection, IntroPhase } from "@/components/auth/useBookFlip";

/*
 * Baybayin script verification list (Unicode Tagalog block U+1700–U+171F):
 * - ᜁᜎᜓᜁᜎᜓ  = "Iloilo" (i-lo-i-lo: U+1701 U+170E U+1713 U+1701 U+170E U+1713)
 * - ᜀᜃ᜔ᜎᜆᜈ᜔ = "Aklatan" / Library (a-k-la-ta-n: U+1700 U+1703 U+1714 U+170E U+1706 U+1708 U+1714)
 * - Basic 17 Baybayin letters:
 *   ᜀ (a)  ᜁ (i/e)  ᜂ (u/o)  ᜃ (ka)  ᜄ (ga)  ᜅ (nga)  ᜆ (ta)  ᜇ (da/ra)
 *   ᜈ (na) ᜉ (pa)   ᜊ (ba)   ᜋ (ma)  ᜌ (ya)  ᜎ (la)   ᜏ (wa)  ᜐ (sa)  ᜑ (ha)
 */
const BAYBAYIN_ILOILO = "ᜁᜎᜓᜁᜎᜓ";
const BAYBAYIN_AKLATAN = "ᜀᜃ᜔ᜎᜆᜈ᜔";

const BAYBAYIN_ROWS_FRONT = [
  "ᜁᜎᜓᜁᜎᜓ · ᜀᜃ᜔ᜎᜆᜈ᜔",
  "ᜀ ᜁ ᜂ ᜃ ᜄ ᜅ",
  "ᜆ ᜇ ᜈ ᜉ ᜊ ᜋ",
  "ᜌ ᜎ ᜏ ᜐ ᜑ ᜁᜎᜓᜁᜎᜓ",
  "ᜀᜃ᜔ᜎᜆᜈ᜔ · ᜀ ᜁ ᜂ",
] as const;

const BAYBAYIN_ROWS_BACK = [
  "ᜀᜃ᜔ᜎᜆᜈ᜔ · ᜁᜎᜓᜁᜎᜓ",
  "ᜉ ᜊ ᜋ ᜌ ᜎ ᜏ",
  "ᜐ ᜑ ᜀ ᜁ ᜂ ᜃ",
  "ᜄ ᜅ ᜆ ᜇ ᜈ ᜁᜎᜓᜁᜎᜓ",
  "ᜁᜎᜓᜁᜎᜓ · ᜀᜃ᜔ᜎᜆᜈ᜔",
] as const;

const FLIP_SPARKS = [
  { top: "18%", delay: "0.12s" },
  { top: "42%", delay: "0.24s" },
  { top: "66%", delay: "0.32s" },
  { top: "82%", delay: "0.2s" },
] as const;

export interface BookProps {
  introPhase: IntroPhase;
  visibleMode: BookMode;
  isFlipping: boolean;
  flipDirection: FlipDirection;
  flipKey: number;
  turnedCount: number;
}

function BaybayinPageLines({ rows }: { rows: readonly string[] }) {
  return (
    <div className="ilpl-parchment-ruled relative flex h-full flex-col justify-center px-1.5 py-1">
      <div aria-hidden="true" className="relative z-10 flex flex-col gap-[0.18rem]">
        {rows.map((row, idx) => (
          <p
            key={idx}
            className="ilpl-baybayin ilpl-parchment-ink truncate text-[0.52rem] leading-[1.3] tracking-[0.04em]"
          >
            {row}
          </p>
        ))}
      </div>
    </div>
  );
}

function BaybayinLeftCoverPage() {
  return (
    <div
      role="img"
      aria-label="Baybayin: Iloilo"
      className="relative flex h-full flex-col items-center justify-between rounded-sm border border-[#f5cf7a]/45 bg-gradient-to-br from-[#19283a] via-[#132030] to-[#0e1824] px-1.5 py-2 text-center shadow-inner"
    >
      <span
        aria-hidden="true"
        className="absolute left-1 top-1 h-2.5 w-2.5 rounded-tl border-l border-t border-[#f5cf7a]/80"
      />
      <span
        aria-hidden="true"
        className="absolute right-1 top-1 h-2.5 w-2.5 rounded-tr border-r border-t border-[#f5cf7a]/80"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1 h-2.5 w-2.5 rounded-bl border-b border-l border-[#f5cf7a]/80"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-br border-b border-r border-[#f5cf7a]/80"
      />

      <div className="mt-0.5 flex flex-col items-center">
        <span
          aria-hidden="true"
          className="ilpl-baybayin text-[1.05rem] leading-none tracking-[0.04em] text-[#f5cf7a] drop-shadow-[0_0_8px_rgba(245,207,122,0.45)]"
        >
          {BAYBAYIN_ILOILO}
        </span>
        <span
          aria-hidden="true"
          className="ilpl-baybayin mt-0.5 text-[0.48rem] tracking-[0.1em] text-[#9fc3ea]/80"
        >
          {BAYBAYIN_AKLATAN}
        </span>
      </div>

      <div>
        <p
          style={{ fontFamily: "var(--font-serif)" }}
          className="text-[0.52rem] font-bold leading-tight text-[#f5cf7a]"
        >
          The Chronicles of Iloilo
        </p>
        <p className="mt-0.5 text-[0.38rem] font-semibold uppercase tracking-[0.12em] text-[#9fc3ea]/80">
          ILOILO CITY PUBLIC LIBRARY
        </p>
      </div>
    </div>
  );
}

export function Book({
  introPhase,
  visibleMode,
  isFlipping,
  flipDirection,
  flipKey,
  turnedCount,
}: BookProps) {
  const isCoverOpen = introPhase !== "closed";
  const glowActive = introPhase === "glowing" || introPhase === "ready";
  const rightRows = visibleMode === "login" ? BAYBAYIN_ROWS_FRONT : BAYBAYIN_ROWS_BACK;
  const leftStackWidth = `${Math.min(10, 2 + turnedCount * 1.4)}px`;

  return (
    <div
      className="ilpl-small-book"
      data-flipping={isFlipping ? "true" : "false"}
      data-dir={flipDirection}
      aria-hidden="true"
    >
      {/* Soft glow pool at the open book gutter (pulses brighter at flip midpoint) */}
      <div
        className="ilpl-book-beam-origin"
        data-active={glowActive ? "true" : "false"}
        data-pulse={isFlipping ? "true" : "false"}
      />

      <div className="ilpl-small-book-tilt">
        <div className="ilpl-book-body">
          {/* Left turned-page stack thickness indicator (grows/shrinks with flips) */}
          <div className="ilpl-turned-stack" style={{ width: leftStackWidth }} />

          <div className="ilpl-spread">
            <div className="ilpl-tome-page ilpl-tome-left">
              <BaybayinLeftCoverPage />
            </div>

            <div className="ilpl-tome-page">
              <BaybayinPageLines rows={rightRows} />
              {/* Moving shadow on the page underneath during a flip */}
              {isFlipping && <div key={`sh-${flipKey}`} className="ilpl-under-shadow" />}
            </div>

            <div className="ilpl-spine-shadow" />
            {/* Cyan gutter glow that pulses brighter at flip midpoint */}
            <div
              className="ilpl-gutter-cyan"
              data-active={glowActive ? "true" : "false"}
              data-pulse={isFlipping ? "true" : "false"}
            />

            {/* 3-page CSS 3D riffle stack (1 hero + 2 staggered trailing pages, 75ms stagger) */}
            {isFlipping && (
              <div key={flipKey} className="ilpl-flip-layer">
                {[0, 1, 2].map((idx) => (
                  <div
                    key={idx}
                    className={`ilpl-flip-sheet ilpl-flip-sheet-${idx}`}
                    data-dir={flipDirection}
                  >
                    {/* Front face */}
                    <div className="ilpl-flip-face ilpl-flip-front">
                      <BaybayinPageLines rows={BAYBAYIN_ROWS_FRONT} />
                      <div className="ilpl-bend-shade" />
                    </div>
                    {/* Back face (mirrored Baybayin rows) */}
                    <div className="ilpl-flip-face ilpl-flip-back">
                      <BaybayinPageLines rows={BAYBAYIN_ROWS_BACK} />
                      <div className="ilpl-bend-shade" />
                    </div>
                  </div>
                ))}

                {/* Tiny sparks released along the flipping page edge */}
                <div className="ilpl-flip-sparks">
                  {FLIP_SPARKS.map((sp, i) => (
                    <span
                      key={i}
                      className="ilpl-flip-spark"
                      style={{ top: sp.top, animationDelay: sp.delay }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Intro Front Cover hinged at the spine (opens smoothly over ~1000ms on load) */}
          <div
            className="ilpl-intro-cover"
            data-open={isCoverOpen ? "true" : "false"}
          >
            <span className="ilpl-baybayin text-xl text-[#f5cf7a]">{BAYBAYIN_ILOILO}</span>
            <p
              style={{ fontFamily: "var(--font-serif)" }}
              className="mt-1 text-[0.55rem] font-bold text-[#f5cf7a]"
            >
              The Chronicles of Iloilo
            </p>
            <p className="text-[0.38rem] uppercase tracking-[0.14em] text-[#9fc3ea]/85">
              ILOILO CITY PUBLIC LIBRARY
            </p>
          </div>
        </div>

        <div className="ilpl-book-shadow" />
      </div>
    </div>
  );
}
