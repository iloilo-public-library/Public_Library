"use client";

import { useState } from "react";
import { AlertTriangle, PieChart, RefreshCw } from "lucide-react";

interface UsersRoleChartCardProps {
  roles: { admin: number; librarian: number; user: number } | undefined;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

export function UsersRoleChartCard({
  roles,
  isLoading,
  hasError,
  onRetry,
}: UsersRoleChartCardProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const items = [
    { label: "Admins", count: roles?.admin ?? 0, color: "var(--c-orange)" },
    { label: "Librarians", count: roles?.librarian ?? 0, color: "var(--c-blue)" },
    { label: "Members", count: roles?.user ?? 0, color: "var(--c-green)" },
  ];

  const total = items.reduce((s, x) => s + x.count, 0);
  const radius = 68;
  const circumference = 2 * Math.PI * radius;

  // Build SVG stroke segments
  let cumulative = 0;
  const segments = items.map((item, idx) => {
    const frac = total > 0 ? item.count / total : 0;
    const dashLen = frac * circumference;
    const offset = -cumulative * circumference;
    cumulative += frac;
    const pct = total > 0 ? Math.round(frac * 100) : 0;
    return { ...item, idx, dashLen, offset, pct };
  });

  const activeSeg = activeIdx !== null ? segments[activeIdx] : null;

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
              backgroundColor: "rgba(155, 120, 232, 0.15)",
              color: "var(--c-purple)",
            }}
          >
            <PieChart className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          Users by Role
        </h2>

        <span
          className="dash-tabular rounded-full px-2 py-0.5 text-[0.64rem] font-bold"
          style={{
            backgroundColor: "rgba(155, 120, 232, 0.13)",
            color: "var(--c-purple)",
            border: "1px solid rgba(155, 120, 232, 0.24)",
          }}
        >
          {isLoading ? "— total" : `${total.toLocaleString()} total`}
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <div
            className="h-[150px] w-[150px] animate-pulse rounded-full"
            style={{ border: "18px solid var(--dash-track-bg)" }}
          />
          <div className="mt-4 w-full space-y-2">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-4 w-full animate-pulse rounded"
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
          No user accounts recorded yet.
        </div>
      ) : (
        <>
          {/* SVG Donut with center readout */}
          <div className="relative flex h-[190px] w-full items-center justify-center">
            <div className="pointer-events-none absolute text-center">
              <div
                className="dash-tabular text-[1.6rem] font-bold leading-none"
                style={{ color: "var(--dash-text-primary)" }}
              >
                {activeSeg ? activeSeg.count.toLocaleString() : total.toLocaleString()}
              </div>
              <div
                className="mt-1 text-[0.65rem] uppercase tracking-[0.06em]"
                style={{ color: "var(--dash-text-muted)" }}
              >
                {activeSeg ? `${activeSeg.label} (${activeSeg.pct}%)` : "total users"}
              </div>
            </div>

            <svg
              viewBox="0 0 180 180"
              className="h-[184px] w-[184px] -rotate-90"
              role="img"
              aria-label={`Users by role chart: ${items
                .map((i) => `${i.label} ${i.count}`)
                .join(", ")}`}
            >
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="var(--dash-track-bg)"
                strokeWidth="22"
              />
              {segments.map((seg) =>
                seg.count > 0 ? (
                  <circle
                    key={seg.label}
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={activeIdx === seg.idx ? 26 : 22}
                    strokeDasharray={`${Math.max(0, seg.dashLen - 2)} ${circumference}`}
                    strokeDashoffset={seg.offset}
                    tabIndex={0}
                    role="button"
                    aria-label={`${seg.label}: ${seg.count} (${seg.pct}%)`}
                    onMouseEnter={() => setActiveIdx(seg.idx)}
                    onMouseLeave={() => setActiveIdx(null)}
                    onFocus={() => setActiveIdx(seg.idx)}
                    onBlur={() => setActiveIdx(null)}
                    className="cursor-pointer transition-[stroke-width] duration-150"
                  >
                    <title>{`${seg.label}: ${seg.count} (${seg.pct}%)`}</title>
                  </circle>
                ) : null
              )}
            </svg>
          </div>

          {/* Custom Legend */}
          <div className="mt-3.5 flex flex-col gap-2">
            {segments.map((seg) => (
              <div
                key={seg.label}
                onMouseEnter={() => setActiveIdx(seg.idx)}
                onMouseLeave={() => setActiveIdx(null)}
                className="flex items-center justify-between text-[0.75rem]"
              >
                <div
                  className="flex items-center gap-2"
                  style={{ color: "var(--dash-text-secondary)" }}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: seg.color }}
                    aria-hidden="true"
                  />
                  <span>{seg.label}</span>
                </div>
                <div className="dash-tabular">
                  <span
                    className="text-[0.82rem] font-bold"
                    style={{ color: "var(--dash-text-primary)" }}
                  >
                    {seg.count.toLocaleString()}
                  </span>
                  <span
                    className="ml-1.5 text-[0.68rem]"
                    style={{ color: "var(--dash-text-faint)" }}
                  >
                    {seg.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Visually hidden table for screen readers */}
          <table className="sr-only">
            <caption>Users by Role</caption>
            <thead>
              <tr>
                <th>Role</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <tr key={seg.label}>
                  <td>{seg.label}</td>
                  <td>{seg.count}</td>
                  <td>{seg.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
