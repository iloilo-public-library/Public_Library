import type { CSSProperties } from "react";

type BookLoaderSize = "sm" | "md" | "lg";

interface BookLoaderProps {
  /** Main status line shown under the book. */
  label?: string;
  /** Small mono eyebrow shown above the label (fullscreen only). */
  eyebrow?: string;
  /** Covers the whole viewport with the animated library backdrop. */
  fullscreen?: boolean;
  size?: BookLoaderSize;
  className?: string;
}

const SIZE_VARS: Record<BookLoaderSize, CSSProperties> = {
  sm: { "--pw": "30px", "--ph": "40px" } as CSSProperties,
  md: { "--pw": "48px", "--ph": "64px" } as CSSProperties,
  lg: { "--pw": "64px", "--ph": "86px" } as CSSProperties,
};

/* Deterministic dust motes (no Math.random → no hydration mismatch). */
const MOTES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  delay: `${(i * 0.73) % 9}s`,
  duration: `${9 + ((i * 1.7) % 7)}s`,
  size: `${2 + (i % 3)}px`,
}));

function Book({ size }: { size: BookLoaderSize }) {
  return (
    <div className="icpl-book" style={SIZE_VARS[size]} aria-hidden="true">
      <div className="icpl-book__cover" />
      <div className="icpl-book__pg icpl-book__pg--l" />
      <div className="icpl-book__pg icpl-book__pg--r" />
      <div className="icpl-book__leaf">
        <div className="icpl-book__face icpl-book__face--f" />
        <div className="icpl-book__face icpl-book__face--b" />
      </div>
      <div className="icpl-book__leaf">
        <div className="icpl-book__face icpl-book__face--f" />
        <div className="icpl-book__face icpl-book__face--b" />
      </div>
      <div className="icpl-book__leaf">
        <div className="icpl-book__face icpl-book__face--f" />
        <div className="icpl-book__face icpl-book__face--b" />
      </div>
      <div className="icpl-book__gutter" />
    </div>
  );
}

export function BookLoader({
  label = "Loading",
  eyebrow = "Iloilo City Public Library",
  fullscreen = false,
  size,
  className = "",
}: BookLoaderProps) {
  const resolvedSize: BookLoaderSize = size ?? (fullscreen ? "lg" : "md");

  if (!fullscreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex flex-col items-center justify-center gap-4 py-10 ${className}`}
      >
        <div className="icpl-book-halo">
          <Book size={resolvedSize} />
        </div>
        <p className="icpl-loader-label text-xs font-semibold tracking-wide text-tl/80">
          {label}
          <span className="icpl-loader-dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className={`icpl-loader-screen ${className}`}>
      {/* Animated library backdrop */}
      <div className="icpl-loader-bg" aria-hidden="true">
        <div className="icpl-loader-aurora icpl-loader-aurora--a" />
        <div className="icpl-loader-aurora icpl-loader-aurora--b" />
        <div className="icpl-loader-aurora icpl-loader-aurora--c" />
        <div className="icpl-loader-grid" />
        <div className="icpl-loader-shelves" />
        <div className="icpl-loader-motes">
          {MOTES.map((m, i) => (
            <span
              key={i}
              style={{
                left: m.left,
                width: m.size,
                height: m.size,
                animationDelay: m.delay,
                animationDuration: m.duration,
              }}
            />
          ))}
        </div>
        <div className="icpl-loader-vignette" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-7 px-6 text-center">
        <div className="icpl-book-halo icpl-book-halo--lg">
          <Book size={resolvedSize} />
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.28em] text-accent/80">
            {eyebrow}
          </span>
          <p className="icpl-loader-label font-sans text-base font-bold tracking-tight text-white sm:text-lg">
            {label}
            <span className="icpl-loader-dots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
          <div className="icpl-loader-bar" aria-hidden="true">
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookLoader;
