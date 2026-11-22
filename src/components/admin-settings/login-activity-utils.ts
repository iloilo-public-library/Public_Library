import type { LoginSession } from "./types";

export type ActivityRange = "6m" | "3m" | "30d" | "12m";

export const RANGE_WEEKS: Record<ActivityRange, number> = {
  "30d": 5,
  "3m": 13,
  "6m": 26,
  "12m": 52,
};

export interface HeatmapCell {
  future: boolean;
  dateKey: string;
  dateLabel: string;
  seconds: number;
  level: 0 | 1 | 2 | 3 | 4;
  tooltip: string;
}

export interface Last7DayBar {
  dateKey: string;
  day: string;
  dateLabel: string;
  seconds: number;
  value: string;
  level: 0 | 1 | 2 | 3 | 4;
  heightPct: number;
  isToday: boolean;
  tooltip: string;
}

export interface RecentSessionItem {
  id: number;
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  duration: string;
  maskedToken: string;
  isLive: boolean;
}

export interface LoginActivityView {
  hasSessionsInRange: boolean;
  totalLabel: string;
  dailyAvgLabel: string;
  daysLoggedIn: number;
  currentStreak: number;
  bestStreak: number;
  longestDayLabel: string;
  longestDayDateLabel: string;
  months: string[];
  columns: HeatmapCell[][];
  last7Days: Last7DayBar[];
  recentSessions: RecentSessionItem[];
  summaryAriaLabel: string;
}

/**
 * Legacy level thresholds from legacy-flask/helpers/login_sessions.py:
 *   0: None (<= 0s)
 *   1: 1h & below (<= 3600s)
 *   2: 2h (<= 7200s)
 *   3: 3h (< 18000s, i.e. under 5h)
 *   4: 5h & above (>= 18000s)
 */
export function getActivityLevel(seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0;
  if (seconds <= 3600) return 1;
  if (seconds <= 7200) return 2;
  if (seconds < 18000) return 3;
  return 4;
}

/**
 * Formats seconds as "Xh YYm" (matching legacy _fmt in login_sessions.py).
 */
export function formatHm(seconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addLocalDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 0, 0, 0, 0);
}

function formatTime12h(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatMonthShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short" });
}

function formatMonthDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeekdayShort(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

/**
 * Resolves a session's [startMs, endMs] interval.
 * - Active sessions (logout_at === null) end at `now`.
 * - Ended sessions use `logout_at` (never estimated if missing/invalid).
 * Returns null if timestamps are invalid or end < start.
 */
function resolveSessionInterval(
  s: LoginSession,
  nowMs: number
): { startMs: number; endMs: number; isLive: boolean } | null {
  const startMs = new Date(s.login_at).getTime();
  if (!Number.isFinite(startMs)) return null;

  const isLive = s.logout_at === null;
  if (isLive) {
    const endMs = Math.max(nowMs, startMs);
    return { startMs, endMs, isLive: true };
  }

  const endMs = new Date(s.logout_at as string).getTime();
  if (!Number.isFinite(endMs) || endMs < startMs) return null;
  return { startMs, endMs, isLive: false };
}

/**
 * Merges overlapping [startMs, endMs] intervals so simultaneous tabs/devices
 * do not double-count logged-in time (matching legacy _merge).
 */
function mergeIntervals(intervals: [number, number][]): [number, number][] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    const last = merged[merged.length - 1];
    if (s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      merged.push([s, e]);
    }
  }
  return merged;
}

/**
 * Splits merged intervals across local midnight boundaries and accumulates
 * seconds per local calendar day ("YYYY-MM-DD").
 *
 * Definitions:
 * - A "day" is the user's local calendar day (e.g. Asia/Manila).
 * - "days logged in" counts distinct local calendar days with >= 1 session in the range.
 * - "current streak" counts consecutive local days ending today (or yesterday if none today).
 * - "best" is the longest consecutive-day streak within the selected range.
 * - "daily average" = total time in range / days logged in.
 */
function accumulateSecondsByLocalDay(
  intervals: [number, number][],
  clampStartMs: number,
  clampEndMs: number
): { secondsByDay: Map<string, number>; daysWithSession: Set<string> } {
  const secondsByDay = new Map<string, number>();
  const daysWithSession = new Set<string>();

  for (const [rawStart, rawEnd] of intervals) {
    const s = Math.max(rawStart, clampStartMs);
    const e = Math.min(rawEnd, clampEndMs);
    if (e < s) continue;

    // Zero-duration session still marks its local calendar day as logged in
    if (e === s) {
      const key = toLocalDateKey(new Date(s));
      daysWithSession.add(key);
      if (!secondsByDay.has(key)) secondsByDay.set(key, 0);
      continue;
    }

    let cursorMs = s;
    while (cursorMs < e) {
      const curDate = new Date(cursorMs);
      const nextMidnightMs = addLocalDays(startOfLocalDay(curDate), 1).getTime();
      const segEndMs = Math.min(e, nextMidnightMs);
      const key = toLocalDateKey(curDate);
      daysWithSession.add(key);
      secondsByDay.set(
        key,
        (secondsByDay.get(key) ?? 0) + (segEndMs - cursorMs) / 1000
      );
      cursorMs = segEndMs;
    }
  }

  return { secondsByDay, daysWithSession };
}

export function computeLoginActivityView(
  sessions: LoginSession[],
  range: ActivityRange,
  now: Date = new Date()
): LoginActivityView {
  const nowMs = now.getTime();
  const today = startOfLocalDay(now);
  const todayKey = toLocalDateKey(today);
  const yesterdayKey = toLocalDateKey(addLocalDays(today, -1));

  // Week starts Sunday (matching legacy: sunday = today - (today.weekday() + 1) % 7)
  const sundayOffset = today.getDay(); // 0=Sun..6=Sat
  const currentSunday = addLocalDays(today, -sundayOffset);
  const weekCount = RANGE_WEEKS[range];
  const rangeStart = addLocalDays(currentSunday, -(weekCount - 1) * 7);
  const rangeStartMs = rangeStart.getTime();

  // Resolve all valid session intervals once
  const validIntervals: [number, number][] = [];
  for (const s of sessions) {
    const resolved = resolveSessionInterval(s, nowMs);
    if (resolved) {
      validIntervals.push([resolved.startMs, resolved.endMs]);
    }
  }
  const mergedAll = mergeIntervals(validIntervals);

  // 1) Range-scoped accumulation (drives 5 tiles + heatmap + month labels)
  const { secondsByDay: rangeSeconds, daysWithSession: rangeDaysSet } =
    accumulateSecondsByLocalDay(mergedAll, rangeStartMs, nowMs);

  const sortedRangeDays = Array.from(rangeDaysSet).sort();
  const daysLoggedIn = sortedRangeDays.length;
  const hasSessionsInRange = daysLoggedIn > 0;

  let totalSeconds = 0;
  for (const sec of rangeSeconds.values()) {
    totalSeconds += sec;
  }

  const dailyAvgSeconds = daysLoggedIn > 0 ? totalSeconds / daysLoggedIn : 0;

  // Streaks within the selected range
  let bestStreak = 0;
  let running = 0;
  let prevDay: Date | null = null;
  for (const key of sortedRangeDays) {
    const [y, m, d] = key.split("-").map(Number);
    const cur = new Date(y, m - 1, d);
    if (prevDay) {
      const diff = Math.round(
        (cur.getTime() - prevDay.getTime()) / (24 * 60 * 60 * 1000)
      );
      running = diff === 1 ? running + 1 : 1;
    } else {
      running = 1;
    }
    if (running > bestStreak) bestStreak = running;
    prevDay = cur;
  }

  let currentStreak = 0;
  let cursor = rangeDaysSet.has(todayKey) ? today : addLocalDays(today, -1);
  while (rangeDaysSet.has(toLocalDateKey(cursor))) {
    currentStreak++;
    cursor = addLocalDays(cursor, -1);
  }

  // Longest day in range
  let longestKey: string | null = null;
  let longestSec = -1;
  for (const key of sortedRangeDays) {
    const sec = rangeSeconds.get(key) ?? 0;
    if (sec > longestSec) {
      longestSec = sec;
      longestKey = key;
    }
  }

  const longestDayLabel = longestKey ? formatHm(longestSec) : "0h 00m";
  const longestDayDateLabel = longestKey
    ? (() => {
        const [y, m, d] = longestKey.split("-").map(Number);
        return formatMonthDay(new Date(y, m - 1, d));
      })()
    : "—";

  // 2) Heatmap columns (Sun..Sat rows, `weekCount` columns) + month labels
  const columns: HeatmapCell[][] = [];
  const months: string[] = [];

  for (let w = 0; w < weekCount; w++) {
    const col: HeatmapCell[] = [];
    let monthLabel = "";

    for (let row = 0; row < 7; row++) {
      const cellDate = addLocalDays(rangeStart, w * 7 + row);
      if (cellDate.getDate() === 1) {
        monthLabel = formatMonthShort(cellDate);
      }
      if (cellDate.getTime() > today.getTime()) {
        col.push({
          future: true,
          dateKey: toLocalDateKey(cellDate),
          dateLabel: "",
          seconds: 0,
          level: 0,
          tooltip: "",
        });
        continue;
      }

      const key = toLocalDateKey(cellDate);
      const sec = rangeSeconds.get(key) ?? 0;
      const hasAny = rangeDaysSet.has(key);
      const level = getActivityLevel(sec);
      const dateLabel = formatFullDate(cellDate);
      const tooltip =
        sec > 0
          ? `${dateLabel}: ${formatHm(sec)} logged in`
          : hasAny
          ? `${dateLabel}: 0h 00m logged in`
          : `${dateLabel}: No activity`;

      col.push({
        future: false,
        dateKey: key,
        dateLabel,
        seconds: sec,
        level,
        tooltip,
      });
    }

    if (w === 0 && !monthLabel) {
      monthLabel = formatMonthShort(rangeStart);
    }

    columns.push(col);
    months.push(monthLabel);
  }

  // 3) Last 7 days (independent of range selector; legacy rolling order today-6..today)
  const sevenDayStart = addLocalDays(today, -6);
  const { secondsByDay: weekSeconds } = accumulateSecondsByLocalDay(
    mergedAll,
    sevenDayStart.getTime(),
    nowMs
  );

  const rawWeek = Array.from({ length: 7 }, (_, idx) => {
    const d = addLocalDays(today, idx - 6);
    const key = toLocalDateKey(d);
    const sec = weekSeconds.get(key) ?? 0;
    return { d, key, sec };
  });

  const maxWeekSec = rawWeek.reduce((max, item) => Math.max(max, item.sec), 0);

  const last7Days: Last7DayBar[] = rawWeek.map(({ d, key, sec }) => {
    const isToday = key === todayKey;
    const heightPct =
      sec <= 0
        ? 0
        : maxWeekSec > 0
        ? Math.max(6, Math.round((sec / maxWeekSec) * 100))
        : 0;
    const dateLabel = `${formatWeekdayShort(d)}, ${formatMonthDay(d)}`;
    return {
      dateKey: key,
      day: formatWeekdayShort(d),
      dateLabel,
      seconds: sec,
      value: sec > 0 ? formatHm(sec) : "–",
      level: getActivityLevel(sec),
      heightPct,
      isToday,
      tooltip:
        sec > 0
          ? `${dateLabel}: ${formatHm(sec)} logged in`
          : `${dateLabel}: No activity`,
    };
  });

  // 4) Recent sessions (independent of range selector, newest first)
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.login_at).getTime() - new Date(a.login_at).getTime()
  );

  const recentSessions: RecentSessionItem[] = sortedSessions.map((s) => {
    const loginDate = new Date(s.login_at);
    const validLogin = !Number.isNaN(loginDate.getTime());
    const resolved = resolveSessionInterval(s, nowMs);
    const isLive = s.logout_at === null;
    const maskedToken = `${s.session_token.slice(0, 10)}…`;

    if (!validLogin) {
      return {
        id: s.id,
        level: 0,
        label: "Unknown session time",
        duration: "–",
        maskedToken,
        isLive: false,
      };
    }

    const dayKey = toLocalDateKey(loginDate);
    const dayPrefix =
      dayKey === todayKey
        ? "Today"
        : dayKey === yesterdayKey
        ? "Yesterday"
        : formatMonthDay(loginDate);

    const startStr = formatTime12h(loginDate);

    if (!resolved) {
      return {
        id: s.id,
        level: 0,
        label: `${dayPrefix} · ${startStr} → –`,
        duration: "–",
        maskedToken,
        isLive: false,
      };
    }

    const durSec = Math.max(0, (resolved.endMs - resolved.startMs) / 1000);
    const endStr = isLive ? "now" : formatTime12h(new Date(resolved.endMs));

    return {
      id: s.id,
      level: getActivityLevel(durSec),
      label: `${dayPrefix} · ${startStr} → ${endStr}`,
      duration: formatHm(durSec),
      maskedToken,
      isLive,
    };
  });

  const totalLabel = formatHm(totalSeconds);
  const dailyAvgLabel = formatHm(dailyAvgSeconds);

  return {
    hasSessionsInRange,
    totalLabel,
    dailyAvgLabel,
    daysLoggedIn,
    currentStreak,
    bestStreak,
    longestDayLabel,
    longestDayDateLabel,
    months,
    columns,
    last7Days,
    recentSessions,
    summaryAriaLabel: `Login activity heatmap: ${totalLabel} total across ${daysLoggedIn} ${
      daysLoggedIn === 1 ? "day" : "days"
    } logged in.`,
  };
}
