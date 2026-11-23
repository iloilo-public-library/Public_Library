export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval?: number | null;
  weekdays?: number[] | null;
  day_of_month?: number | null;
  until?: string | null;
  count?: number | null;
}

export interface MasterEventRecord {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  end_date?: string | null;
  start_time: string | null;
  end_time: string | null;
  all_day?: boolean | null;
  timezone?: string | null;
  location: string | null;
  category: string | null;
  audience?: string | null;
  cover_image?: string | null;
  image?: string | null;
  recurrence_freq?: RecurrenceFreq | null;
  recurrence_interval?: number | null;
  recurrence_weekdays?: number[] | null;
  recurrence_day_of_month?: number | null;
  recurrence_until?: string | null;
  recurrence_count?: number | null;
}

export interface EventExceptionRecord {
  event_id: number;
  original_date: string;
  action: "skipped" | "modified";
  title?: string | null;
  description?: string | null;
  event_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean | null;
  location?: string | null;
  category?: string | null;
  cover_image?: string | null;
}

export interface ExpandedEventOccurrence extends MasterEventRecord {
  master_id: number;
  occurrence_date: string;
  is_recurring: boolean;
}

export const MAX_RANGE_DAYS = 100;
export const MAX_OCCURRENCES_PER_REQUEST = 366;
export const MAX_RULE_SPAN_YEARS = 5;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseIsoDate(ds: string): { year: number; month: number; day: number } {
  const [y, m, d] = ds.slice(0, 10).split("-").map(Number);
  return { year: y, month: m, day: d };
}

export function formatIsoDate(year: number, month: number, day: number): string {
  const dt = new Date(Date.UTC(year, month - 1, day));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function addDaysIso(ds: string, days: number): string {
  const { year, month, day } = parseIsoDate(ds);
  return formatIsoDate(year, month, day + days);
}

export function diffDaysIso(from: string, to: string): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000
  );
}

export function dayOfWeekIso(ds: string): number {
  const { year, month, day } = parseIsoDate(ds);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function daysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function computeSplitUntilDate(occurrenceDate: string): string {
  return addDaysIso(occurrenceDate, -1);
}

export function expandSingleEvent(
  master: MasterEventRecord,
  exceptions: EventExceptionRecord[],
  rangeFrom: string,
  rangeTo: string,
  maxOccurrences = MAX_OCCURRENCES_PER_REQUEST
): ExpandedEventOccurrence[] {
  const startDate = (master.event_date || "").slice(0, 10);
  if (!startDate) return [];

  const durationDays = master.end_date
    ? Math.max(0, diffDaysIso(startDate, master.end_date.slice(0, 10)))
    : 0;

  const exMap = new Map<string, EventExceptionRecord>();
  for (const ex of exceptions) {
    if (ex.event_id === master.id && ex.original_date) {
      exMap.set(ex.original_date.slice(0, 10), ex);
    }
  }

  const freq = master.recurrence_freq;
  if (!freq) {
    const endDate = addDaysIso(startDate, durationDays);
    if (endDate < rangeFrom || startDate > rangeTo) return [];
    return [
      {
        ...master,
        event_date: startDate,
        end_date: durationDays > 0 ? endDate : master.end_date ?? null,
        master_id: master.id,
        occurrence_date: startDate,
        is_recurring: false,
      },
    ];
  }

  const interval = Math.min(12, Math.max(1, Number(master.recurrence_interval ?? 1)));
  const maxCount =
    master.recurrence_count && master.recurrence_count > 0
      ? Math.min(MAX_OCCURRENCES_PER_REQUEST, master.recurrence_count)
      : null;

  const startParts = parseIsoDate(startDate);
  const hardHorizon = formatIsoDate(
    startParts.year + MAX_RULE_SPAN_YEARS,
    startParts.month,
    startParts.day
  );
  const effectiveUntil = [rangeTo, master.recurrence_until?.slice(0, 10) || hardHorizon, hardHorizon]
    .filter(Boolean)
    .sort()[0];

  const results: ExpandedEventOccurrence[] = [];
  let generatedCount = 0;

  const pushCandidate = (occDate: string): boolean => {
    if (occDate < startDate) return true;
    if (occDate > effectiveUntil) return false;
    generatedCount += 1;
    if (maxCount !== null && generatedCount > maxCount) return false;
    if (results.length >= maxOccurrences) return false;

    const ex = exMap.get(occDate);
    if (ex?.action === "skipped") return true;

    const effectiveStart = ex?.action === "modified" && ex.event_date ? ex.event_date.slice(0, 10) : occDate;
    const effectiveEnd =
      ex?.action === "modified" && ex.end_date
        ? ex.end_date.slice(0, 10)
        : durationDays > 0
          ? addDaysIso(effectiveStart, durationDays)
          : null;

    const overlapEnd = effectiveEnd ?? effectiveStart;
    if (overlapEnd >= rangeFrom && effectiveStart <= rangeTo) {
      results.push({
        ...master,
        title: ex?.action === "modified" && ex.title != null ? ex.title : master.title,
        description:
          ex?.action === "modified" && ex.description !== undefined
            ? ex.description
            : master.description,
        event_date: effectiveStart,
        end_date: effectiveEnd,
        start_time:
          ex?.action === "modified" && ex.start_time !== undefined ? ex.start_time : master.start_time,
        end_time:
          ex?.action === "modified" && ex.end_time !== undefined ? ex.end_time : master.end_time,
        all_day:
          ex?.action === "modified" && ex.all_day !== undefined && ex.all_day !== null
            ? ex.all_day
            : master.all_day,
        location:
          ex?.action === "modified" && ex.location !== undefined ? ex.location : master.location,
        category: ex?.action === "modified" && ex.category != null ? ex.category : master.category,
        cover_image:
          ex?.action === "modified" && ex.cover_image !== undefined
            ? ex.cover_image
            : master.cover_image,
        master_id: master.id,
        occurrence_date: occDate,
        is_recurring: true,
      });
    }
    return true;
  };

  if (freq === "daily") {
    let cur = startDate;
    let guard = 0;
    while (cur <= effectiveUntil && guard < 2000) {
      guard++;
      if (!pushCandidate(cur)) break;
      cur = addDaysIso(cur, interval);
    }
  } else if (freq === "weekly") {
    const weekdays =
      Array.isArray(master.recurrence_weekdays) && master.recurrence_weekdays.length > 0
        ? Array.from(
            new Set(master.recurrence_weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
          ).sort((a, b) => a - b)
        : [dayOfWeekIso(startDate)];

    const startWeekSunday = addDaysIso(startDate, -dayOfWeekIso(startDate));
    let weekIndex = 0;
    while (weekIndex < 300) {
      const weekSunday = addDaysIso(startWeekSunday, weekIndex * interval * 7);
      if (weekSunday > effectiveUntil) break;
      let keepGoing = true;
      for (const wd of weekdays) {
        const occ = addDaysIso(weekSunday, wd);
        if (occ < startDate) continue;
        if (!pushCandidate(occ)) {
          keepGoing = false;
          break;
        }
      }
      if (!keepGoing) break;
      weekIndex++;
    }
  } else if (freq === "monthly") {
    const targetDom = master.recurrence_day_of_month ?? startParts.day;
    let step = 0;
    while (step < 120) {
      const totalMonths = startParts.year * 12 + (startParts.month - 1) + step * interval;
      const y = Math.floor(totalMonths / 12);
      const m = (totalMonths % 12) + 1;
      const clampedDay = Math.min(targetDom, daysInMonthUtc(y, m));
      const occ = formatIsoDate(y, m, clampedDay);
      if (!pushCandidate(occ)) break;
      step++;
    }
  } else if (freq === "yearly") {
    let step = 0;
    while (step < 20) {
      const y = startParts.year + step * interval;
      const clampedDay = Math.min(startParts.day, daysInMonthUtc(y, startParts.month));
      const occ = formatIsoDate(y, startParts.month, clampedDay);
      if (!pushCandidate(occ)) break;
      step++;
    }
  }

  return results;
}

export function expandEventsForRange(
  masters: MasterEventRecord[],
  exceptions: EventExceptionRecord[],
  rangeFrom: string,
  rangeTo: string,
  cap = MAX_OCCURRENCES_PER_REQUEST
): { occurrences: ExpandedEventOccurrence[]; truncated: boolean } {
  const all: ExpandedEventOccurrence[] = [];
  let truncated = false;

  for (const master of masters) {
    const remaining = cap - all.length;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const expanded = expandSingleEvent(master, exceptions, rangeFrom, rangeTo, remaining + 1);
    if (expanded.length > remaining) {
      all.push(...expanded.slice(0, remaining));
      truncated = true;
      break;
    }
    all.push(...expanded);
  }

  all.sort((a, b) => {
    const dc = a.event_date.localeCompare(b.event_date);
    if (dc !== 0) return dc;
    return (a.start_time || "").localeCompare(b.start_time || "");
  });

  return { occurrences: all, truncated };
}
