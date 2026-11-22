"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export type SubmitButtonState = "idle" | "loading" | "success" | "error";

interface FloatingFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "placeholder"> {
  id: string;
  label: string;
  icon: ReactNode;
  rightSlot?: ReactNode;
  labelAction?: ReactNode;
  error?: string | null;
  shakeKey?: number;
}

/**
 * Floating-label input (54px tall, 1rem font, gold focus ring, shake on error,
 * smooth 0fr -> 1fr error reveal, ARIA invalid/describedby).
 */
export const FloatingField = forwardRef<HTMLInputElement, FloatingFieldProps>(function FloatingField(
  {
    id,
    label,
    icon,
    rightSlot,
    labelAction,
    error,
    shakeKey = 0,
    className = "",
    ...inputProps
  },
  ref
) {
  const errorId = `${id}-error`;
  const hasError = Boolean(error);

  return (
    <div className="ilpl-field">
      {labelAction && <div className="flex justify-end">{labelAction}</div>}
      <div
        key={hasError ? `err-${shakeKey}` : "ok"}
        className={`ilpl-float-wrap ${hasError ? "ilpl-shake" : ""}`}
        data-invalid={hasError ? "true" : "false"}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#9fc3ea]/85"
        >
          {icon}
        </span>

        {/* placeholder=" " enables CSS :not(:placeholder-shown) floating label */}
        <input
          ref={ref}
          id={id}
          placeholder=" "
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          className={`ilpl-input ilpl-float-input ${className}`}
          {...inputProps}
        />

        <label htmlFor={id} className="ilpl-float-label">
          {label}
        </label>

        {rightSlot}
      </div>

      {/* Smooth 0fr -> 1fr error reveal */}
      <div className="ilpl-error-collapse" data-open={hasError ? "true" : "false"}>
        <div className="ilpl-error-collapse-inner">
          {hasError && (
            <p id={errorId} role="alert" className="ilpl-field-error">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

/** Animated SVG Eye / Eye-Slash toggle with stroke-dashoffset draw. */
export function PasswordEyeToggle({
  shown,
  disabled,
  onToggle,
}: {
  shown: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      aria-pressed={shown}
      className="ilpl-eye-btn"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        <path
          d="M4 20 L20 4"
          className="ilpl-eye-slash"
          data-drawn={shown ? "true" : "false"}
        />
      </svg>
    </button>
  );
}

interface MorphSubmitButtonProps {
  state: SubmitButtonState;
  locked: boolean;
  idleLabel: string;
  shakeKey?: number;
  icon: ReactNode;
}

/**
 * Morphing Submit Button:
 * idle -> loading (shrinks into circle with rotating spinner) -> success (animated SVG checkmark)
 * or error (returns to idle with shake). Keeps button focusable via aria-disabled.
 */
export function MorphSubmitButton({
  state,
  locked,
  idleLabel,
  shakeKey = 0,
  icon,
}: MorphSubmitButtonProps) {
  const isLoading = state === "loading";
  const isSuccess = state === "success";
  const isError = state === "error";

  return (
    <div className="ilpl-submit-slot">
      <button
        key={isError ? `btn-err-${shakeKey}` : "btn-ok"}
        type="submit"
        aria-disabled={locked || isLoading || isSuccess}
        data-state={state}
        className={`ilpl-submit ${isError ? "ilpl-shake" : ""}`}
      >
        {isLoading ? (
          <>
            <span className="ilpl-btn-spinner" aria-hidden="true" />
            <span className="ilpl-btn-loading-text">Loading...</span>
          </>
        ) : isSuccess ? (
          <svg
            viewBox="0 0 28 28"
            className="h-6 w-6 text-[#0b2418]"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 14.5 L11.5 20 L22 8.5" className="ilpl-check-path" />
          </svg>
        ) : (
          <>
            {icon}
            <span>{idleLabel}</span>
          </>
        )}
      </button>
    </div>
  );
}

export function StatusBanner({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  return (
    <div aria-live="polite" aria-atomic="true">
      <div className="ilpl-error-collapse" data-open={error ? "true" : "false"}>
        <div className="ilpl-error-collapse-inner">
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#ff6b6b]/45 bg-[#3b1219]/90 px-4 py-3 text-sm leading-snug text-[#ffd2d2]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {success && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#48c78e]/45 bg-[#0e2e23]/90 px-4 py-3 text-sm leading-snug text-[#bbf7d0]"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}
