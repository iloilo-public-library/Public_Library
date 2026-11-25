"use client";

import { useMemo } from "react";
import { AlertTriangle, RefreshCw, Tag } from "lucide-react";
import type { InventorySnapshotRow } from "./types";

interface TopCategoriesCardProps {
  rows: InventorySnapshotRow[];
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

export function TopCategoriesCard({
  rows,
  isLoading,
  hasError,
  onRetry,
}: TopCategoriesCardProps) {
  const { sorted, maxVal, total } = useMemo(() => {
    const catMap = new Map<string, number>();
    for (const row of rows) {
      const cat = (row.category || "Uncategorized").trim() || "Uncategorized";
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
    }
    const entries = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);
    const max = entries[0]?.[1] ?? 1;
    return { sorted: entries, maxVal: max, total: rows.length };
  }, [rows]);

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
              backgroundColor: "rgba(45, 212, 191, 0.15)",
              color: "var(--c-teal)",
            }}
          >
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          Top Categories
        </h2>

        <span
          className="dash-tabular rounded-full px-2 py-0.5 text-[0.64rem] font-bold"
          style={{
            backgroundColor: "rgba(45, 212, 191, 0.13)",
            color: "var(--c-teal)",
            border: "1px solid rgba(45, 212, 191, 0.24)",
          }}
        >
          {isLoading ? "— titles" : `${total.toLocaleString()} titles`}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3 py-3">
          {[85, 70, 58, 46, 35].map((w, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between">
                <div
                  className="h-3 w-28 animate-pulse rounded"
                  style={{ backgroundColor: "var(--dash-track-bg)" }}
                />
                <div
                  className="h-3 w-8 animate-pulse rounded"
                  style={{ backgroundColor: "var(--dash-track-bg)" }}
                />
              </div>
              <div
                className="h-2 animate-pulse rounded-full"
                style={{ width: `${w}%`, backgroundColor: "var(--dash-track-bg)" }}
              />
            </div>
          ))}
        </div>
      ) : hasError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-10 text-center">
          <AlertTriangle className="h-6 w-6" style={{ color: "var(--c-red)" }} aria-hidden="true" />
          <p className="text-xs font-semibold" style={{ color: "var(--c-red)" }}>
            Failed to load categories
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
      ) : sorted.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center py-12 text-xs"
          style={{ color: "var(--dash-text-muted)" }}
        >
          No category data available
        </div>
      ) : (
        <div className="mt-1 flex flex-col gap-[11px]">
          {sorted.map(([cat, count]) => {
            const pct = Math.round((count / maxVal) * 100);
            return (
              <div key={cat}>
                <div className="mb-[5px] flex items-baseline justify-between gap-2">
                  <span
                    className="max-w-[200px] truncate text-[0.75rem] font-semibold"
                    style={{ color: "var(--dash-text-secondary)" }}
                    title={cat}
                  >
                    {cat}
                  </span>
                  <span
                    className="dash-tabular text-[0.82rem] font-bold"
                    style={{ color: "var(--c-teal)" }}
                  >
                    {count.toLocaleString()}
                  </span>
                </div>
                <div
                  className="h-[7px] w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: "var(--dash-track-bg)" }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${pct}%`,
                      background: "linear-gradient(90deg, var(--c-teal), var(--c-blue))",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
