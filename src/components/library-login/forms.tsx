"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface HoloFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  icon: ReactNode;
  rightSlot?: ReactNode;
  labelAction?: ReactNode;
}

export function HoloField({
  id,
  label,
  icon,
  rightSlot,
  labelAction,
  className = "",
  ...inputProps
}: HoloFieldProps) {
  return (
    <div className="ilpl-field">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="ilpl-label">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="ilpl-input-wrap">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9fc3ea]/80"
        >
          {icon}
        </span>
        <input id={id} className={`ilpl-input ${className}`} {...inputProps} />
        <span className="ilpl-ink-line" aria-hidden="true" />
        {rightSlot}
      </div>
    </div>
  );
}

interface HoloSubmitProps {
  loading: boolean;
  succeeded?: boolean;
  idleLabel: string;
  loadingLabel: string;
  successLabel?: string;
  icon: ReactNode;
}

export function HoloSubmit({
  loading,
  succeeded = false,
  idleLabel,
  loadingLabel,
  successLabel = "Signed In",
  icon,
}: HoloSubmitProps) {
  return (
    <button
      type="submit"
      disabled={loading || succeeded}
      data-state={succeeded ? "success" : loading ? "loading" : "idle"}
      className="ilpl-submit"
    >
      {succeeded ? (
        <>
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successLabel}</span>
        </>
      ) : loading ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {icon}
          <span>{idleLabel}</span>
        </>
      )}
    </button>
  );
}

interface StatusBannerProps {
  error: string | null;
  success: string | null;
}

export function StatusBanner({ error, success }: StatusBannerProps) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {error && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-lg border border-[#ff6b6b]/45 bg-[#3b1219]/85 px-3 py-2 text-xs leading-snug text-[#ffd2d2]"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div
          role="status"
          className="mb-3 flex items-start gap-2 rounded-lg border border-[#48c78e]/45 bg-[#0e2e23]/85 px-3 py-2 text-xs leading-snug text-[#bbf7d0]"
        >
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}

