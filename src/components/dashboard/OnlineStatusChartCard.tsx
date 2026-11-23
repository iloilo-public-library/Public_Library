"use client";

import { useState } from "react";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";

interface OnlineStatusChartCardProps {
  status: { active: number; offline: number; locked: number } | undefined;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

export function OnlineStatusChartCard({
  status,
  isLoading,
  hasError,
  onRetry,
}: OnlineStatusChartCardProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const active = status?.active ?? 0;
  const offline = status?.offline ?? 0;
  const total = active + offline;
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
  const maxVal = Math.max(1, active, offline);

  const bars = [
    {
      label: "Active",
      value: active,
      pct: Math.round((active / maxVal) * 100),
      color: "var(--c-green)",
    },
    {
      label: "Offline",
      value: offline,
      pct: Math.round((offline / maxVal) * 100),
      color: "var(--c-orange)",
    },
  ];

  const ticks = [0, Math.round(maxVal / 2), maxVal];

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
              backgroundColor: "rgba(62, 207, 142, 0.15)",
              color: "var(--c-green)",
            }}
          >
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          Online Status
        </h2>

        <span
          className="rounded-full px-2 py-0.5 text-[0.64rem] font-bold"
          style={{
            backgroundColor: "rgba(62, 207, 142, 0.13)",
            color: "var(--c-green)",
            border: "1px solid rgba(62, 207, 142, 0.24)",
          }}
        >
          Live
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-1 flex-col justify-between gap-4 py-4">
          <div className="space-y-4">
            <div
              className="h-8 w-full animate-pulse rounded-lg"
              style={{ backgroundColor: "var(--dash-track-bg)" }}
            />
            <div
              className="h-8 w-3/4 animate-pulse rounded-lg"
              style={{ backgroundColor: "var(--dash-track-bg)" }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-14 animate-pulse rounded-lg"
                style={{ backgroundColor: "var(--dash-track-bg)" }}
              />
            ))}
          </div>
        </div>
      ) : hasError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-10 text-center">
          <AlertTriangle className="h-6 w-6" style={{ color: "var(--c-red)" }} aria-hidden="true" />
          <p className="text-xs font-semibold" style={{ color: "var(--c-red)" }}>
            Failed to load
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
      ) : total === 0 ? (
        <div
          className="flex flex-1 items-center justify-center py-14 text-xs"
          style={{ color: "var(--dash-text-muted)" }}
        >
          No user activity data yet.
        </div>
      ) : (
        <>
          {/* Horizontal Bar Chart */}
          <div
            className="flex h-[190px] flex-col justify-center gap-4"
            role="img"
            aria-label={`Online status chart: ${active} Active, ${offline} Offline (${activePct}% active)`}
          >
            <div className="min-h-[18px] text-right text-[0.7rem]" style={{ color: "var(--dash-text-muted)" }}>
              {hovered ?? "\u00A0"}
            </div>

            {bars.map((bar) => (
              <div key={bar.label} className="flex items-center gap-3">
                <span
                  className="w-12 shrink-0 text-[0.74rem] font-semibold"
                  style={{ color: "var(--dash-text-secondary)" }}
                >
                  {bar.label}
                </span>
                <div
                  className="relative h-8 flex-1 overflow-hidden rounded-lg"
                  style={{ backgroundColor: "var(--dash-track-bg)" }}
                >
                  <button
                    type="button"
                    aria-label={`${bar.label}: ${bar.value} users`}
                    title={`${bar.label}: ${bar.value} users`}
                    onMouseEnter={() => setHovered(`${bar.label}: ${bar.value.toLocaleString()} users`)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(`${bar.label}: ${bar.value.toLocaleString()} users`)}
                    onBlur={() => setHovered(null)}
                    className="block h-full rounded-lg border-0 p-0 transition-all duration-500 cursor-pointer"
                    style={{
                      width: `${bar.value > 0 ? Math.max(4, bar.pct) : 0}%`,
                      backgroundColor: bar.color,
                    }}
                  />
                </div>
                <span
                  className="dash-tabular w-9 shrink-0 text-right text-xs font-bold"
                  style={{ color: "var(--dash-text-primary)" }}
                >
                  {bar.value.toLocaleString()}
                </span>
              </div>
            ))}

            {/* X-axis scale ticks */}
            <div
              className="ml-[60px] mr-12 flex justify-between pt-1 text-[0.65rem] dash-tabular"
              style={{
                borderTop: "1px solid var(--dash-grid-line)",
                color: "var(--dash-text-faint)",
              }}
            >
              {ticks.map((t, i) => (
                <span key={i}>{t.toLocaleString()}</span>
              ))}
            </div>
          </div>

          {/* Mini 3-cell Row */}
          <div className="mt-3 grid grid-cols-3 gap-[7px]">
            <div
              className="rounded-[9px] px-1.5 py-2.5 text-center"
              style={{
                backgroundColor: "var(--dash-inner-bg)",
                border: "1px solid var(--dash-border-subtle)",
              }}
            >
              <div
                className="dash-tabular text-[1.1rem] font-bold leading-none"
                style={{ color: "var(--c-green)" }}
              >
                {active.toLocaleString()}
              </div>
              <div
                className="mt-1 text-[0.6rem] uppercase tracking-[0.06em]"
                style={{ color: "var(--dash-text-faint)" }}
              >
                Active
              </div>
            </div>

            <div
              className="rounded-[9px] px-1.5 py-2.5 text-center"
              style={{
                backgroundColor: "var(--dash-inner-bg)",
                border: "1px solid var(--dash-border-subtle)",
              }}
            >
              <div
                className="dash-tabular text-[1.1rem] font-bold leading-none"
                style={{ color: "var(--c-orange)" }}
              >
                {offline.toLocaleString()}
              </div>
              <div
                className="mt-1 text-[0.6rem] uppercase tracking-[0.06em]"
                style={{ color: "var(--dash-text-faint)" }}
              >
                Offline
              </div>
            </div>

            <div
              className="rounded-[9px] px-1.5 py-2.5 text-center"
              style={{
                backgroundColor: "var(--dash-inner-bg)",
                border: "1px solid var(--dash-border-subtle)",
              }}
            >
              <div
                className="dash-tabular text-[1.1rem] font-bold leading-none"
                style={{ color: "var(--c-teal)" }}
              >
                {activePct}%
              </div>
              <div
                className="mt-1 text-[0.6rem] uppercase tracking-[0.06em]"
                style={{ color: "var(--dash-text-faint)" }}
              >
                Active %
              </div>
            </div>
          </div>

          {/* Visually hidden table for screen readers */}
          <table className="sr-only">
            <caption>Online Status</caption>
            <thead>
              <tr>
                <th>Status</th>
                <th>Users</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Active</td>
                <td>{active}</td>
              </tr>
              <tr>
                <td>Offline</td>
                <td>{offline}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
