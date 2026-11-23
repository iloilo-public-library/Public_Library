"use client";

import type { ReactNode } from "react";

export type AuthMode = "login" | "signup";

interface AuthCardProps {
  mode: AuthMode;
  isBusy: boolean;
  announcement: string;
  onModeChange: (target: AuthMode) => void;
  children: ReactNode;
}

function CornerOrnament({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 h-6 w-6 text-[#f5cf7a]/75 ${className}`}
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
 * Translucent navy auth card with 1px gold border, gold outer glow, corner ornaments,
 * rolling gold serif headline, fading subtitle, and bottom mode-switch link.
 * Mode switching is controlled by the top-bar buttons and the bottom link (no in-card tabs).
 */
export function AuthCard({
  mode,
  isBusy,
  announcement,
  onModeChange,
  children,
}: AuthCardProps) {
  return (
    <div className="ilpl-card-wrap" data-mode={mode} aria-busy={isBusy}>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className="ilpl-card">
        <div className="ilpl-card-glass" aria-hidden="true" />

        <CornerOrnament className="left-3 top-3" />
        <CornerOrnament className="right-3 top-3 scale-x-[-1]" />
        <CornerOrnament className="bottom-3 left-3 scale-y-[-1]" />
        <CornerOrnament className="bottom-3 right-3 scale-[-1]" />

        <div className="ilpl-card-inner">
          {/* Rolling Headline + Fading Subtitle (sits cleanly at top of card) */}
          <div className="ilpl-card-header">
            <p className="ilpl-card-eyebrow">Official Portal Access</p>
            <h2 className="ilpl-headline-roll">
              <span className="ilpl-headline-track">
                <span className="ilpl-headline-line" aria-hidden={mode === "signup"}>
                  Welcome back
                </span>
                <span className="ilpl-headline-line" aria-hidden={mode === "login"}>
                  Create your account
                </span>
              </span>
            </h2>
            <p className="ilpl-card-desc" key={mode}>
              {mode === "login"
                ? "Enter your registered credentials to access Iloilo City Public Library services."
                : "Register for your official Iloilo City Public Library membership card."}
            </p>
          </div>

          {children}

          {/* Clean bottom mode-switch text link (0.9375rem, >=44px tap target) */}
          <div className="ilpl-mode-switch">
            {mode === "login" ? (
              <button
                type="button"
                aria-disabled={isBusy}
                onClick={() => onModeChange("signup")}
                className="ilpl-mode-switch-btn"
              >
                New here? <span className="text-[#f5cf7a] underline underline-offset-4">Create an account</span>
              </button>
            ) : (
              <button
                type="button"
                aria-disabled={isBusy}
                onClick={() => onModeChange("login")}
                className="ilpl-mode-switch-btn"
              >
                Already have an account? <span className="text-[#f5cf7a] underline underline-offset-4">Log in</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
