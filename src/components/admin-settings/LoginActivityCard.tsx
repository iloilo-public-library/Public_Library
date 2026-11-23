"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, LogIn } from "lucide-react";
import type { LoginSession } from "./types";
import {
  computeLoginActivityView,
  formatHm,
  type ActivityRange,
} from "./login-activity-utils";

interface LoginActivityCardProps {
  sessions: LoginSession[];
}

const RANGE_OPTIONS: { value: ActivityRange; label: string }[] = [
  { value: "6m", label: "Last 6 months" },
  { value: "3m", label: "Last 3 months" },
  { value: "30d", label: "Last 30 days" },
  { value: "12m", label: "Last 12 months" },
];

const INITIAL_VISIBLE_SESSIONS = 5;

const LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "as-l0",
  1: "as-l1",
  2: "as-l2",
  3: "as-l3",
  4: "as-l4",
};

export function LoginActivityCard({ sessions }: LoginActivityCardProps) {
  const [range, setRange] = useState<ActivityRange>("6m");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [hoveredTip, setHoveredTip] = useState<string | null>(null);
  const heatmapScrollRef = useRef<HTMLDivElement | null>(null);

  const view = useMemo(
    () => computeLoginActivityView(sessions, range),
    [sessions, range]
  );

  // Scroll heatmap container to the most recent weeks on load and range change
  useEffect(() => {
    const el = heatmapScrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [range, view.columns.length]);

  const visibleSessions = showAllSessions
    ? view.recentSessions
    : view.recentSessions.slice(0, INITIAL_VISIBLE_SESSIONS);
  const remainingCount = Math.max(
    0,
    view.recentSessions.length - INITIAL_VISIBLE_SESSIONS
  );

  // Non-future cells for the visually hidden accessible data list
  const accessibleDays = useMemo(() => {
    const out: { dateKey: string; dateLabel: string; seconds: number }[] = [];
    for (const col of view.columns) {
      for (const cell of col) {
        if (!cell.future && cell.seconds > 0) {
          out.push({
            dateKey: cell.dateKey,
            dateLabel: cell.dateLabel,
            seconds: cell.seconds,
          });
        }
      }
    }
    return out;
  }, [view.columns]);

  return (
    <div
      className="mb-[18px] overflow-hidden rounded-[16px]"
      style={{
        backgroundColor: "var(--as-card-bg)",
        border: "1px solid var(--as-border)",
      }}
    >
      {/* 1. Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-3.5"
        style={{ borderBottom: "1px solid var(--as-border)" }}
      >
        <span
          className="flex items-center gap-2 text-[0.78rem] font-bold uppercase tracking-[0.07em]"
          style={{ color: "var(--accent)" }}
        >
          <Clock className="h-4 w-4" aria-hidden="true" />
          Login Activity
        </span>

        <label className="sr-only" htmlFor="as-login-activity-range">
          Login activity time range
        </label>
        <select
          id="as-login-activity-range"
          value={range}
          onChange={(e) => setRange(e.target.value as ActivityRange)}
          className="min-h-[44px] rounded-lg px-3 py-1.5 text-[0.75rem] font-semibold cursor-pointer"
          style={{
            color: "var(--accent)",
            backgroundColor: "rgba(var(--accent-rgb), 0.1)",
            border: "1px solid rgba(var(--accent-rgb), 0.2)",
          }}
        >
          {RANGE_OPTIONS.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              style={{
                backgroundColor: "var(--as-card-bg)",
                color: "var(--as-text-primary)",
              }}
            >
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Five Stat Tiles (>=1024px: 5 in 1 row; 640-1023px: 3+2; <640px: 2 cols) */}
      <div
        className="grid grid-cols-2 gap-[1px] sm:grid-cols-3 lg:grid-cols-5"
        style={{
          backgroundColor: "var(--as-border)",
          borderBottom: "1px solid var(--as-border)",
        }}
      >
        <div className="px-[18px] py-4" style={{ backgroundColor: "var(--as-stat-bg)" }}>
          <div
            className="as-tabular font-mono text-[1.15rem] font-medium tracking-[-0.02em]"
            style={{ color: "var(--as-text-primary)" }}
          >
            {view.totalLabel}
          </div>
          <div className="mt-1 text-[0.7rem]" style={{ color: "var(--as-text-muted)" }}>
            Total time logged in
          </div>
        </div>

        <div className="px-[18px] py-4" style={{ backgroundColor: "var(--as-stat-bg)" }}>
          <div
            className="as-tabular font-mono text-[1.15rem] font-medium tracking-[-0.02em]"
            style={{ color: "var(--as-text-primary)" }}
          >
            {view.dailyAvgLabel}
          </div>
          <div className="mt-1 text-[0.7rem]" style={{ color: "var(--as-text-muted)" }}>
            Daily average
          </div>
        </div>

        <div className="px-[18px] py-4" style={{ backgroundColor: "var(--as-stat-bg)" }}>
          <div
            className="as-tabular font-mono text-[1.15rem] font-medium tracking-[-0.02em]"
            style={{ color: "var(--as-text-primary)" }}
          >
            {view.daysLoggedIn}{" "}
            <small className="text-[0.72rem]" style={{ color: "var(--as-text-muted)" }}>
              days
            </small>
          </div>
          <div className="mt-1 text-[0.7rem]" style={{ color: "var(--as-text-muted)" }}>
            Days logged in
          </div>
        </div>

        <div className="px-[18px] py-4" style={{ backgroundColor: "var(--as-stat-bg)" }}>
          <div
            className="as-tabular font-mono text-[1.15rem] font-medium tracking-[-0.02em]"
            style={{ color: "var(--as-text-primary)" }}
          >
            {view.currentStreak}{" "}
            <small className="text-[0.72rem]" style={{ color: "var(--as-text-muted)" }}>
              days
            </small>
          </div>
          <div className="mt-1 text-[0.7rem]" style={{ color: "var(--as-text-muted)" }}>
            Current streak · best {view.bestStreak}
          </div>
        </div>

        <div
          className="col-span-2 px-[18px] py-4 sm:col-span-1"
          style={{ backgroundColor: "var(--as-stat-bg)" }}
        >
          <div
            className="as-tabular font-mono text-[1.15rem] font-medium tracking-[-0.02em]"
            style={{ color: "var(--as-text-primary)" }}
          >
            {view.longestDayLabel}
          </div>
          <div className="mt-1 text-[0.7rem]" style={{ color: "var(--as-text-muted)" }}>
            Longest day · {view.longestDayDateLabel}
          </div>
        </div>
      </div>

      {/* 3. GitHub-Style Heatmap */}
      <div
        className="px-5 pb-4 pt-[18px]"
        style={{ borderBottom: "1px solid var(--as-border)" }}
      >
        {!view.hasSessionsInRange ? (
          <div
            className="rounded-xl px-4 py-7 text-center text-[0.82rem]"
            style={{
              backgroundColor: "var(--as-card-subtle)",
              color: "var(--as-text-muted)",
            }}
          >
            No login activity recorded in this time range yet.
          </div>
        ) : (
          <>
            <div
              ref={heatmapScrollRef}
              className="overflow-x-auto pb-1.5"
              role="img"
              aria-label={view.summaryAriaLabel}
            >
              {/* Month Labels */}
              <div className="mb-[5px] flex w-max gap-[3px]">
                <span className="w-[28px] shrink-0" aria-hidden="true" />
                {view.months.map((m, idx) => (
                  <span
                    key={idx}
                    className="w-[14px] shrink-0 overflow-visible whitespace-nowrap text-[0.66rem]"
                    style={{ color: "var(--as-text-muted)" }}
                  >
                    {m}
                  </span>
                ))}
              </div>

              {/* Weekday Labels + Week Columns (Sun top -> Sat bottom) */}
              <div className="flex w-max gap-[3px]">
                <div
                  className="flex w-[28px] shrink-0 flex-col gap-[3px]"
                  aria-hidden="true"
                >
                  {["", "Mon", "", "Wed", "", "Fri", ""].map((lbl, idx) => (
                    <span
                      key={idx}
                      className="h-[14px] text-[0.62rem] leading-[14px]"
                      style={{ color: "var(--as-text-faint)" }}
                    >
                      {lbl}
                    </span>
                  ))}
                </div>

                {view.columns.map((col, colIdx) => (
                  <div key={colIdx} className="flex flex-col gap-[3px]">
                    {col.map((cell) =>
                      cell.future ? (
                        <span
                          key={cell.dateKey}
                          className="inline-block h-[14px] w-[14px] shrink-0 rounded-[3px] bg-transparent"
                          aria-hidden="true"
                        />
                      ) : (
                        <button
                          key={cell.dateKey}
                          type="button"
                          title={cell.tooltip}
                          aria-label={cell.tooltip}
                          onMouseEnter={() => setHoveredTip(cell.tooltip)}
                          onMouseLeave={() => setHoveredTip(null)}
                          onFocus={() => setHoveredTip(cell.tooltip)}
                          onBlur={() => setHoveredTip(null)}
                          className={`inline-block h-[14px] w-[14px] shrink-0 rounded-[3px] border-0 p-0 cursor-pointer ${
                            LEVEL_CLASS[cell.level]
                          }`}
                        />
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Live hover/focus readout + Caption & Legend */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span
                className="text-[0.72rem]"
                style={{ color: hoveredTip ? "var(--as-text-secondary)" : "var(--as-text-faint)" }}
              >
                {hoveredTip ??
                  "Each square is one day, coloured by hours logged in."}
              </span>

              <div className="flex flex-wrap items-center gap-3">
                {(
                  [
                    { level: 0, label: "None" },
                    { level: 1, label: "1h & below" },
                    { level: 2, label: "2h" },
                    { level: 3, label: "3h" },
                    { level: 4, label: "5h & above" },
                  ] as const
                ).map((item) => (
                  <span
                    key={item.level}
                    className="inline-flex items-center gap-1.5 text-[0.68rem]"
                    style={{ color: "var(--as-text-muted)" }}
                  >
                    <span
                      className={`inline-block h-[14px] w-[14px] shrink-0 rounded-[3px] ${
                        LEVEL_CLASS[item.level]
                      }`}
                      aria-hidden="true"
                    />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Visually hidden per-day data list for screen readers */}
            <ul className="sr-only">
              {accessibleDays.map((d) => (
                <li key={d.dateKey}>
                  {d.dateLabel}: {formatHm(d.seconds)} logged in
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* 4. LAST 7 DAYS */}
      <div
        className="px-5 pb-2 pt-4 text-[0.68rem] font-bold uppercase tracking-[0.1em]"
        style={{ color: "var(--as-text-faint)" }}
      >
        Last 7 days
      </div>

      <div
        className="flex gap-1.5 px-5 pb-[18px] pt-1 sm:gap-2.5"
        style={{ borderBottom: "1px solid var(--as-border)" }}
      >
        {view.last7Days.map((d) => (
          <div
            key={d.dateKey}
            title={d.tooltip}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <div
              className="as-tabular whitespace-nowrap font-mono text-[0.6rem] sm:text-[0.62rem]"
              style={{
                color: d.isToday ? "var(--accent)" : "var(--as-text-muted)",
              }}
            >
              {d.value}
            </div>

            <div
              className="flex h-[90px] w-full max-w-[44px] items-end overflow-hidden rounded-[6px]"
              style={{
                backgroundColor: "var(--as-bar-track)",
                outline: d.isToday ? "1px solid rgba(var(--accent-rgb), 0.35)" : "none",
              }}
            >
              {d.heightPct > 0 && (
                <div
                  className={`as-bar-fill w-full rounded-t-[6px] ${LEVEL_CLASS[d.level]}`}
                  style={{ height: `${d.heightPct}%` }}
                />
              )}
            </div>

            <div
              className="text-[0.68rem] sm:text-[0.7rem]"
              style={{
                color: d.isToday ? "var(--accent)" : "var(--as-text-muted)",
                fontWeight: d.isToday ? 700 : 400,
              }}
            >
              {d.day}
            </div>
          </div>
        ))}
      </div>

      {/* 5. RECENT SESSIONS */}
      <div
        className="px-5 pb-2 pt-4 text-[0.68rem] font-bold uppercase tracking-[0.1em]"
        style={{ color: "var(--as-text-faint)" }}
      >
        Recent sessions
      </div>

      {visibleSessions.length === 0 ? (
        <div
          className="px-5 py-3.5 text-[0.83rem]"
          style={{ color: "var(--as-text-muted)" }}
        >
          No sessions recorded yet.
        </div>
      ) : (
        <div>
          {visibleSessions.map((s, idx) => (
            <div
              key={s.id}
              title={`Session ${s.maskedToken}`}
              className="flex items-start gap-[13px] px-5 py-[13px]"
              style={{
                borderBottom:
                  idx === visibleSessions.length - 1 && remainingCount === 0
                    ? "none"
                    : "1px solid var(--as-border-subtle)",
              }}
            >
              <span
                className={`mt-1 h-[10px] w-[10px] shrink-0 rounded-[3px] ${
                  LEVEL_CLASS[s.level]
                }`}
                aria-hidden="true"
              />
              <div
                className="flex min-w-0 flex-1 items-center gap-1.5 text-[0.83rem] leading-[1.5]"
                style={{ color: "var(--as-text-secondary)" }}
              >
                <LogIn
                  className="h-3.5 w-3.5 shrink-0 opacity-70"
                  aria-hidden="true"
                />
                <span className="truncate">{s.label}</span>
                <span className="sr-only"> (Session token {s.maskedToken})</span>
              </div>
              <div
                className="as-tabular shrink-0 whitespace-nowrap font-mono text-[0.76rem]"
                style={{ color: "var(--as-text-secondary)" }}
              >
                {s.duration}
              </div>
            </div>
          ))}

          {remainingCount > 0 && (
            <div className="px-5 py-2.5">
              <button
                type="button"
                onClick={() => setShowAllSessions((v) => !v)}
                className="inline-flex min-h-[44px] items-center rounded-lg px-3.5 py-2 text-[0.76rem] font-semibold transition cursor-pointer"
                style={{
                  color: "var(--accent)",
                  backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                  border: "1px solid rgba(var(--accent-rgb), 0.2)",
                }}
              >
                {showAllSessions
                  ? "Show less"
                  : `Show more (${remainingCount} more)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
