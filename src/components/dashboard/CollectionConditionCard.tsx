"use client";

import { AlertTriangle, HeartPulse, RefreshCw } from "lucide-react";

interface CollectionConditionCardProps {
  totalCopies: number;
  available: number;
  damaged: number;
  lost: number;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

export function CollectionConditionCard({
  totalCopies,
  available,
  damaged,
  lost,
  isLoading,
  hasError,
  onRetry,
}: CollectionConditionCardProps) {
  const grandTotal = available + damaged + lost;
  const denom = Math.max(1, grandTotal);
  const pA = grandTotal > 0 ? Math.round((available / denom) * 100) : 0;
  const pD = grandTotal > 0 ? Math.round((damaged / denom) * 100) : 0;
  const pL = grandTotal > 0 ? Math.round((lost / denom) * 100) : 0;

  const rows = [
    { label: "Available", count: available, pct: pA, color: "var(--c-teal)" },
    { label: "Damaged", count: damaged, pct: pD, color: "var(--c-orange)" },
    { label: "Lost", count: lost, pct: pL, color: "var(--c-red)" },
  ];

  return (
    <div className="dash-chart-card">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <h2
          className="flex items-center gap-2 text-[0.76rem] font-bold uppercase tracking-[0.07em]"
          style={{ color: "var(--dash-text-primary)" }}
        >
          <span
            className="flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-[7px]"
            style={{
              backgroundColor: "rgba(247, 201, 72, 0.15)",
              color: "var(--c-gold)",
            }}
          >
            <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          Collection Condition
        </h2>

        <span
          className="dash-tabular rounded-full px-2 py-0.5 text-[0.64rem] font-bold"
          style={{
            backgroundColor: "rgba(247, 201, 72, 0.13)",
            color: "var(--c-gold)",
            border: "1px solid rgba(247, 201, 72, 0.24)",
          }}
        >
          {isLoading ? "— copies total" : `${totalCopies.toLocaleString()} copies total`}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-14 animate-pulse rounded-[10px]"
                style={{ backgroundColor: "var(--dash-track-bg)" }}
              />
            ))}
          </div>
          <div
            className="h-[34px] w-full animate-pulse rounded-[10px]"
            style={{ backgroundColor: "var(--dash-track-bg)" }}
          />
          <div className="space-y-3">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-6 w-full animate-pulse rounded"
                style={{ backgroundColor: "var(--dash-track-bg)" }}
              />
            ))}
          </div>
        </div>
      ) : hasError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-10 text-center">
          <AlertTriangle className="h-6 w-6" style={{ color: "var(--c-red)" }} aria-hidden="true" />
          <p className="text-xs font-semibold" style={{ color: "var(--c-red)" }}>
            Failed to load inventory
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold cursor-pointer"
            style={{
              backgroundColor: "var(--dash-inner-bg)",
              border: "1px solid var(--dash-border)",
              color: "var(--dash-text-primary)",
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : totalCopies === 0 && grandTotal === 0 ? (
        <div
          className="flex flex-1 items-center justify-center py-12 text-xs"
          style={{ color: "var(--dash-text-muted)" }}
        >
          No physical inventory copies recorded yet.
        </div>
      ) : (
        <>
          {/* Summary stat chips */}
          <div className="mb-3.5 grid grid-cols-3 gap-2">
            {rows.map((r) => (
              <div
                key={r.label}
                className="rounded-[10px] px-2 py-2.5 text-center"
                style={{
                  backgroundColor: "var(--dash-inner-bg)",
                  border: "1px solid var(--dash-border-subtle)",
                }}
              >
                <div
                  className="dash-tabular text-[1.2rem] font-bold leading-none"
                  style={{ color: r.color }}
                >
                  {r.count.toLocaleString()}
                </div>
                <div
                  className="mt-1 text-[0.6rem] uppercase tracking-[0.06em]"
                  style={{ color: "var(--dash-text-faint)" }}
                >
                  {r.label}
                </div>
              </div>
            ))}
          </div>

          {/* Stacked Bar */}
          <div
            className="mb-3.5 flex h-[34px] w-full overflow-hidden rounded-[10px]"
            style={{ backgroundColor: "var(--dash-track-bg)" }}
            role="img"
            aria-label={`Collection condition: ${pA}% Available, ${pD}% Damaged, ${pL}% Lost`}
          >
            {rows.map((r) =>
              r.pct > 0 ? (
                <div
                  key={r.label}
                  title={`${r.label}: ${r.count.toLocaleString()} (${r.pct}%)`}
                  className="flex h-full items-center justify-center overflow-hidden whitespace-nowrap text-[0.7rem] font-bold text-white/90 transition-[width] duration-700"
                  style={{ width: `${r.pct}%`, backgroundColor: r.color }}
                >
                  {r.pct >= 8 ? `${r.pct}%` : ""}
                </div>
              ) : null
            )}
          </div>

          {/* Individual Progress Bars */}
          <div className="flex flex-col gap-[11px]">
            {rows.map((r) => (
              <div key={r.label}>
                <div className="mb-[5px] flex items-baseline justify-between">
                  <span
                    className="flex items-center gap-[7px] text-[0.75rem] font-semibold"
                    style={{ color: "var(--dash-text-secondary)" }}
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: r.color }}
                      aria-hidden="true"
                    />
                    {r.label}
                  </span>
                  <span
                    className="dash-tabular text-[0.82rem] font-bold"
                    style={{ color: r.color }}
                  >
                    {r.count.toLocaleString()}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: "var(--dash-track-bg)" }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${r.pct}%`, backgroundColor: r.color }}
                  />
                </div>
                <div
                  className="mt-[3px] text-right text-[0.62rem]"
                  style={{ color: "var(--dash-text-faint)" }}
                >
                  {r.pct}% of collection
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
