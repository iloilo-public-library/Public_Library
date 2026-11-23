"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";

interface BooksAddedPoint {
  label: string;
  count: number;
}

interface BooksAddedChartCardProps {
  booksPerDay: BooksAddedPoint[] | undefined;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

export function BooksAddedChartCard({
  booksPerDay,
  isLoading,
  hasError,
  onRetry,
}: BooksAddedChartCardProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const series = booksPerDay ?? [];
  const maxVal = Math.max(1, ...series.map((d) => d.count));

  // SVG coordinate system
  const width = 340;
  const height = 180;
  const padL = 28;
  const padR = 14;
  const padT = 18;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const points = series.map((d, i) => {
    const x =
      series.length > 1 ? padL + (i / (series.length - 1)) * plotW : padL + plotW / 2;
    const y = padT + plotH - (d.count / maxVal) * plotH;
    return { ...d, x, y, i };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(
          1
        )} L ${points[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : "";

  const yTicks = [0, Math.ceil(maxVal / 2), maxVal];
  const activePoint = activeIdx !== null ? points[activeIdx] : null;

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
              backgroundColor: "rgba(91, 155, 213, 0.15)",
              color: "var(--c-blue)",
            }}
          >
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          Books Added
        </h2>

        <span
          className="rounded-full px-2 py-0.5 text-[0.64rem] font-bold"
          style={{
            backgroundColor: "rgba(91, 155, 213, 0.13)",
            color: "var(--c-blue)",
            border: "1px solid rgba(91, 155, 213, 0.24)",
          }}
        >
          Last 7 Days
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-end gap-2 py-6">
          {[35, 60, 45, 80, 50, 70, 55].map((h, i) => (
            <div
              key={i}
              className="flex-1 animate-pulse rounded-t-md"
              style={{
                height: `${h}%`,
                backgroundColor: "var(--dash-track-bg)",
              }}
            />
          ))}
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
      ) : series.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center py-14 text-xs"
          style={{ color: "var(--dash-text-muted)" }}
        >
          No book addition records for the last 7 days.
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-between">
          <div
            className="mb-1 min-h-[18px] text-right text-[0.72rem] dash-tabular"
            style={{ color: activePoint ? "var(--c-blue)" : "var(--dash-text-faint)" }}
          >
            {activePoint
              ? `${activePoint.label}: ${activePoint.count} book(s)`
              : "Hover or focus a point for details"}
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-[190px] w-full min-w-[260px]"
              role="img"
              aria-label={`Books added over the last 7 days: ${series
                .map((d) => `${d.label} ${d.count}`)
                .join(", ")}`}
            >
              <defs>
                <linearGradient id="booksAddedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b9bd5" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#5b9bd5" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal gridlines + Y-axis labels */}
              {yTicks.map((t, idx) => {
                const y = padT + plotH - (t / maxVal) * plotH;
                return (
                  <g key={idx}>
                    <line
                      x1={padL}
                      x2={width - padR}
                      y1={y}
                      y2={y}
                      stroke="var(--dash-grid-line)"
                      strokeWidth="1"
                    />
                    <text
                      x={padL - 6}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="9.5"
                      fill="var(--dash-text-faint)"
                    >
                      {t}
                    </text>
                  </g>
                );
              })}

              {/* Area fill */}
              <path d={areaPath} fill="url(#booksAddedGrad)" />

              {/* Line stroke */}
              <path
                d={linePath}
                fill="none"
                stroke="#5b9bd5"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive points + X-axis labels */}
              {points.map((p) => {
                const isActive = activeIdx === p.i;
                return (
                  <g key={p.label}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isActive ? 6 : 4}
                      fill={isActive ? "#ffffff" : "#5b9bd5"}
                      stroke={isActive ? "#5b9bd5" : "var(--dash-donut-stroke)"}
                      strokeWidth="2"
                      tabIndex={0}
                      role="button"
                      aria-label={`${p.label}: ${p.count} book(s)`}
                      onMouseEnter={() => setActiveIdx(p.i)}
                      onMouseLeave={() => setActiveIdx(null)}
                      onFocus={() => setActiveIdx(p.i)}
                      onBlur={() => setActiveIdx(null)}
                      className="cursor-pointer transition-all duration-150"
                    >
                      <title>{`${p.label}: ${p.count} book(s)`}</title>
                    </circle>
                    <text
                      x={p.x}
                      y={height - 8}
                      textAnchor="middle"
                      fontSize="9.5"
                      fill="var(--dash-text-faint)"
                    >
                      {p.label.split(" ")[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Visually hidden table for screen readers */}
          <table className="sr-only">
            <caption>Books Added (Last 7 Days)</caption>
            <thead>
              <tr>
                <th>Day</th>
                <th>Books Added</th>
              </tr>
            </thead>
            <tbody>
              {series.map((d) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
