export type EventCategory = string;
export type CalendarViewMode = "month" | "week" | "day" | "list";
export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";
export type EventEditScope = "this" | "following" | "all";

export interface EventCategoryRow {
  id: number;
  slug: string;
  name: string;
  color: string;
  is_system?: boolean;
}

export interface CalendarEventRow {
  id: number;
  master_id?: number;
  occurrence_date?: string;
  is_recurring?: boolean;
  title: string;
  description: string | null;
  event_date: string; // YYYY-MM-DD
  end_date?: string | null;
  start_time: string | null; // HH:MM or HH:MM:SS
  end_time: string | null; // HH:MM or HH:MM:SS
  all_day?: boolean | null;
  timezone?: string | null;
  location: string | null;
  category: string | null;
  audience?: "all" | "members" | "staff" | string | null;
  cover_image?: string | null;
  image?: string | null;
  reminders?: number[];
  recurrence_freq?: RecurrenceFreq | null;
  recurrence_interval?: number | null;
  recurrence_weekdays?: number[] | null;
  recurrence_day_of_month?: number | null;
  recurrence_until?: string | null;
  recurrence_count?: number | null;
}

export interface CategoryMeta {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  border: string;
}

export const BUILTIN_CATEGORIES: Record<string, CategoryMeta> = {
  general: {
    key: "general",
    label: "General",
    shortLabel: "General",
    color: "#48c78e",
    bg: "rgba(72, 199, 142, 0.2)",
    border: "rgba(72, 199, 142, 0.45)",
  },
  workshop: {
    key: "workshop",
    label: "Workshop / Seminar",
    shortLabel: "Workshop",
    color: "#9fc1e1",
    bg: "rgba(159, 193, 225, 0.2)",
    border: "rgba(159, 193, 225, 0.45)",
  },
  holiday: {
    key: "holiday",
    label: "Holiday",
    shortLabel: "Holiday",
    color: "#f7c94b",
    bg: "rgba(247, 201, 75, 0.2)",
    border: "rgba(247, 201, 75, 0.45)",
  },
  exhibit: {
    key: "exhibit",
    label: "Exhibit",
    shortLabel: "Exhibit",
    color: "#c882ff",
    bg: "rgba(200, 130, 255, 0.2)",
    border: "rgba(200, 130, 255, 0.45)",
  },
  closure: {
    key: "closure",
    label: "Closure / Cancelled",
    shortLabel: "Closure",
    color: "#ff6363",
    bg: "rgba(255, 99, 99, 0.2)",
    border: "rgba(255, 99, 99, 0.45)",
  },
};

export const REMINDER_OPTIONS = [
  { minutes: 10, label: "10 min before" },
  { minutes: 30, label: "30 min before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 1440, label: "1 day before" },
] as const;

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return `rgba(72, 199, 142, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(72, 199, 142, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildCategoryList(rows?: EventCategoryRow[]): CategoryMeta[] {
  if (!rows || rows.length === 0) {
    return Object.values(BUILTIN_CATEGORIES);
  }
  return rows.map((r) => {
    const slug = r.slug.toLowerCase();
    const color = r.color || BUILTIN_CATEGORIES[slug]?.color || "#48c78e";
    return {
      key: slug,
      label: r.name,
      shortLabel: r.name.split("/")[0].trim(),
      color,
      bg: hexToRgba(color, 0.2),
      border: hexToRgba(color, 0.45),
    };
  });
}

export function getCategoryMeta(
  cat: string | null | undefined,
  categoryList?: CategoryMeta[]
): CategoryMeta {
  const key = (cat || "general").toLowerCase();
  if (categoryList) {
    const found = categoryList.find((c) => c.key === key);
    if (found) return found;
  }
  return BUILTIN_CATEGORIES[key] ?? BUILTIN_CATEGORIES.general;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function getManilaNowParts(): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dateStr: string;
} {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") === 24 ? 0 : get("hour");
  const minute = get("minute");
  return {
    year,
    month,
    day,
    hour,
    minute,
    dateStr: `${year}-${pad2(month)}-${pad2(day)}`,
  };
}

export function parseDateStr(ds: string): { year: number; month: number; day: number } {
  const [y, m, d] = ds.slice(0, 10).split("-").map(Number);
  return {
    year: Number.isFinite(y) ? y : 2026,
    month: Number.isFinite(m) ? m : 1,
    day: Number.isFinite(d) ? d : 1,
  };
}

export function toDateStr(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function addDays(ds: string, delta: number): string {
  const { year, month, day } = parseDateStr(ds);
  return toDateStr(year, month, day + delta);
}

export function diffDays(from: string, to: string): number {
  const a = parseDateStr(from);
  const b = parseDateStr(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000
  );
}

export function addMonths(ds: string, delta: number): string {
  const { year, month, day } = parseDateStr(ds);
  const target = new Date(Date.UTC(year, month - 1 + delta, 1));
  const maxDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return toDateStr(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(day, maxDay));
}

export function getDayOfWeek(ds: string): number {
  const { year, month, day } = parseDateStr(ds);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function getStartOfWeek(ds: string): string {
  return addDays(ds, -getDayOfWeek(ds));
}

export interface MonthCell {
  dateStr: string;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

export function buildMonthGrid(anchorDateStr: string, todayStr: string): MonthCell[][] {
  const { year, month } = parseDateStr(anchorDateStr);
  const firstOfMonth = toDateStr(year, month, 1);
  const startDow = getDayOfWeek(firstOfMonth);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = startDow + daysInMonth > 35 ? 42 : 35;

  const gridStart = addDays(firstOfMonth, -startDow);
  const weeks: MonthCell[][] = [];
  for (let w = 0; w < totalCells / 7; w++) {
    const row: MonthCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = addDays(gridStart, w * 7 + d);
      const p = parseDateStr(dateStr);
      row.push({
        dateStr,
        day: p.day,
        inCurrentMonth: p.year === year && p.month === month,
        isToday: dateStr === todayStr,
      });
    }
    weeks.push(row);
  }
  return weeks;
}

export function buildWeekDays(anchorDateStr: string, todayStr: string): MonthCell[] {
  const start = getStartOfWeek(anchorDateStr);
  return Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDays(start, i);
    const p = parseDateStr(dateStr);
    return {
      dateStr,
      day: p.day,
      inCurrentMonth: true,
      isToday: dateStr === todayStr,
    };
  });
}

/** Returns the visible [from, to] ISO date range (always <= 42 days, well under 100-day cap). */
export function getVisibleDateRange(
  anchorDate: string,
  view: CalendarViewMode
): { from: string; to: string } {
  if (view === "week") {
    const start = getStartOfWeek(anchorDate);
    return { from: start, to: addDays(start, 6) };
  }
  if (view === "day") {
    return { from: anchorDate, to: anchorDate };
  }
  const weeks = buildMonthGrid(anchorDate, anchorDate);
  const first = weeks[0]?.[0]?.dateStr ?? anchorDate;
  const lastRow = weeks[weeks.length - 1];
  const last = lastRow?.[lastRow.length - 1]?.dateStr ?? anchorDate;
  return { from: first, to: last };
}

export function formatLongDate(ds: string): string {
  if (!ds) return "—";
  const { year, month, day } = parseDateStr(ds);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatAccessibleDay(ds: string): string {
  const { year, month, day } = parseDateStr(ds);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonthTitle(ds: string): string {
  const { year, month } = parseDateStr(ds);
  return new Date(Date.UTC(year, month - 1, 15, 12)).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: "long",
    year: "numeric",
  });
}

export function formatWeekRangeTitle(ds: string): string {
  const start = getStartOfWeek(ds);
  const end = addDays(start, 6);
  const sp = parseDateStr(start);
  const ep = parseDateStr(end);
  const sStr = new Date(Date.UTC(sp.year, sp.month - 1, sp.day, 12)).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  });
  const eStr = new Date(Date.UTC(ep.year, ep.month - 1, ep.day, 12)).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: sp.month === ep.month ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });
  return `${sStr} – ${eStr}`;
}

export function formatDateBadge(ds: string): { day: number; mon: string } {
  const { year, month, day } = parseDateStr(ds);
  const dt = new Date(Date.UTC(year, month - 1, day, 12));
  return {
    day,
    mon: dt.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short" }),
  };
}

export function normalizeHHMM(t: string | null | undefined): string {
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return "";
  return `${pad2(Number(m[1]))}:${m[2]}`;
}

export function formatTime12h(t: string | null | undefined): string {
  const hhmm = normalizeHHMM(t);
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${ampm}`;
}

export function isAllDayEvent(ev: CalendarEventRow): boolean {
  if (ev.all_day) return true;
  return !normalizeHHMM(ev.start_time) && !normalizeHHMM(ev.end_time);
}

export function eventOccursOnDate(ev: CalendarEventRow, dateStr: string): boolean {
  const start = (ev.event_date || "").slice(0, 10);
  if (!start) return false;
  const end = (ev.end_date || start).slice(0, 10);
  return dateStr >= start && dateStr <= end;
}

export function timeToMinutes(t: string | null | undefined): number {
  const hhmm = normalizeHHMM(t);
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function eventInstanceKey(ev: CalendarEventRow): string {
  return `${ev.master_id ?? ev.id}:${ev.occurrence_date ?? ev.event_date}`;
}

export function computeEventStats(events: CalendarEventRow[], todayStr: string) {
  const { year, month } = parseDateStr(todayStr);
  const weekStart = getStartOfWeek(todayStr);
  const weekEnd = addDays(weekStart, 6);

  let thisMonth = 0;
  let thisWeek = 0;
  let upcoming = 0;

  for (const ev of events) {
    const ds = (ev.event_date || "").slice(0, 10);
    if (!ds) continue;
    const p = parseDateStr(ds);
    if (p.year === year && p.month === month) thisMonth++;
    if (ds >= weekStart && ds <= weekEnd) thisWeek++;
    if (ds >= todayStr) upcoming++;
  }

  const nextUpcoming = events
    .filter((ev) => (ev.event_date || "").slice(0, 10) >= todayStr)
    .sort((a, b) => {
      const cmp = (a.event_date || "").localeCompare(b.event_date || "");
      if (cmp !== 0) return cmp;
      return normalizeHHMM(a.start_time).localeCompare(normalizeHHMM(b.start_time));
    })
    .slice(0, 5);

  return {
    total: events.length,
    thisMonth,
    thisWeek,
    upcoming,
    nextUpcoming,
  };
}

export function parseCalendarHash(
  hash: string,
  fallbackDate: string
): { dateStr: string; view: CalendarViewMode } {
  const clean = hash.replace(/^#/, "").trim();
  if (!clean) return { dateStr: fallbackDate, view: "month" };
  const parts = clean.split("&");
  let dateStr = fallbackDate;
  let view: CalendarViewMode = "month";

  for (const part of parts) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
      dateStr = part;
    } else if (/^\d{4}-\d{2}$/.test(part)) {
      dateStr = `${part}-01`;
    } else if (part.startsWith("view=")) {
      const v = part.slice(5) as CalendarViewMode;
      if (v === "month" || v === "week" || v === "day" || v === "list") {
        view = v;
      }
    }
  }
  return { dateStr, view };
}

export function buildCalendarHash(dateStr: string, view: CalendarViewMode): string {
  return `#${dateStr}&view=${view}`;
}
