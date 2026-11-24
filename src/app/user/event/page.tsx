"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutList,
  MapPin,
  X,
} from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import {
  type CalendarEventRow,
  WEEKDAY_LABELS,
  addMonths,
  buildMonthGrid,
  eventOccursOnDate,
  formatDateBadge,
  formatLongDate,
  formatMonthTitle,
  formatTime12h,
  getCategoryMeta,
  getManilaNowParts,
  isAllDayEvent,
} from "@/components/calendar/calendar-utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { swrPublicConfig } from "@/lib/api";

const FILTER_CATEGORIES = [
  { key: "all", label: "All Events" },
  { key: "general", label: "General" },
  { key: "workshop", label: "Workshop" },
  { key: "storytelling", label: "Storytelling" },
  { key: "holiday", label: "Holiday" },
  { key: "closure", label: "Closure" },
];

function resolveEventCover(ev: CalendarEventRow): string | null {
  const raw = (ev.cover_image ?? ev.image ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) {
    return raw;
  }
  return `/cover/events/${raw.replace(/^\/+/, "")}`;
}

export default function UserEventsPage() {
  const { data, isLoading } = useSWR<{ rows?: CalendarEventRow[] }>(
    "/api/admin/data?resource=events",
    swrPublicConfig
  );

  const todayStr = useMemo(() => getManilaNowParts().dateStr, []);
  const [anchorDate, setAnchorDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventRow | null>(null);

  const rawEvents = data?.rows ?? [];

  const filteredEvents = useMemo(() => {
    if (categoryFilter === "all") return rawEvents;
    return rawEvents.filter(
      (ev) => (ev.category || "general").toLowerCase() === categoryFilter
    );
  }, [rawEvents, categoryFilter]);

  const monthWeeks = useMemo(
    () => buildMonthGrid(anchorDate, todayStr),
    [anchorDate, todayStr]
  );

  const upcomingEvents = useMemo(() => {
    return [...filteredEvents]
      .filter((ev) => (ev.end_date || ev.event_date) >= todayStr)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 8);
  }, [filteredEvents, todayStr]);

  const sortedAllEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => b.event_date.localeCompare(a.event_date));
  }, [filteredEvents]);

  return (
    <MemberShell>
      {/* Editorial Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold uppercase">
            Community Calendar &middot; Iloilo City Public Library
          </div>
          <h1 className="font-serif text-[clamp(1.85rem,3vw,2.5rem)] font-bold leading-tight tracking-[-0.02em] text-white">
            Library <span className="text-accent">Events &amp; Programs</span>
          </h1>
          <p className="mt-1 text-sm text-tl/80">
            Upcoming storytelling sessions, workshops, holidays, and community gatherings.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="inline-flex items-center gap-1 rounded-2xl border border-white/12 bg-white/[0.04] p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              viewMode === "calendar"
                ? "border border-accent/35 bg-accent/18 text-accent"
                : "text-tl/75 hover:text-white"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              viewMode === "list"
                ? "border border-accent/35 bg-accent/18 text-accent"
                : "text-tl/75 hover:text-white"
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            List
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {FILTER_CATEGORIES.map((cat) => {
          const active = categoryFilter === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategoryFilter(cat.key)}
              className={`inline-flex h-9 cursor-pointer items-center rounded-full border px-4 text-xs font-semibold transition ${
                active
                  ? "border-gold/45 bg-gold/15 text-gold"
                  : "border-white/12 bg-white/[0.035] text-tl/80 backdrop-blur-md hover:border-white/22 hover:text-white"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-[460px] animate-pulse rounded-[22px] bg-white/5 lg:col-span-8" />
          <div className="h-[460px] animate-pulse rounded-[22px] bg-white/5 lg:col-span-4" />
        </div>
      ) : viewMode === "calendar" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT 8 COLS: INTERACTIVE MONTH CALENDAR */}
          <div className="lg:col-span-8">
            <div className="overflow-hidden rounded-[22px] border border-white/12 bg-white/[0.035] shadow-[0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur-md">
              {/* Calendar Controls Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <h2 className="font-serif text-lg font-bold tracking-tight text-white">
                  {formatMonthTitle(anchorDate)}
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAnchorDate((d) => addMonths(d, -1))}
                    aria-label="Previous month"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-tl/85 transition hover:border-accent/40 hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnchorDate(todayStr)}
                    className="h-8 cursor-pointer rounded-lg border border-white/12 bg-white/[0.04] px-3 text-xs font-semibold text-tl transition hover:border-gold/45 hover:text-gold"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnchorDate((d) => addMonths(d, 1))}
                    aria-label="Next month"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-tl/85 transition hover:border-accent/40 hover:text-white"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 border-b border-white/8 bg-white/[0.02]">
                {WEEKDAY_LABELS.map((wd) => (
                  <div
                    key={wd}
                    className="py-2.5 text-center font-mono text-[0.68rem] font-bold tracking-[0.12em] text-accent/80 uppercase"
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 divide-x divide-y divide-white/[0.06]">
                {monthWeeks.flat().map((cell) => {
                  const dayEvents = filteredEvents.filter((ev) =>
                    eventOccursOnDate(ev, cell.dateStr)
                  );
                  return (
                    <div
                      key={cell.dateStr}
                      className={`min-h-[92px] p-1.5 transition sm:min-h-[106px] sm:p-2 ${
                        cell.inCurrentMonth ? "bg-transparent" : "bg-black/20 opacity-45"
                      } ${cell.isToday ? "ring-1 ring-inset ring-gold/55 bg-gold/[0.05]" : ""}`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 font-mono text-[0.72rem] font-semibold ${
                            cell.isToday
                              ? "bg-gold text-[#111924] font-bold"
                              : cell.inCurrentMonth
                                ? "text-white/85"
                                : "text-white/40"
                          }`}
                        >
                          {cell.day}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="font-mono text-[0.62rem] text-tl/55">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const meta = getCategoryMeta(ev.category);
                          return (
                            <button
                              key={`${ev.id}-${cell.dateStr}`}
                              type="button"
                              onClick={() => setSelectedEvent(ev)}
                              style={{
                                backgroundColor: meta.bg,
                                borderColor: meta.border,
                                color: meta.color,
                              }}
                              className="block w-full cursor-pointer truncate rounded-md border px-1.5 py-0.5 text-left text-[0.68rem] font-semibold transition hover:brightness-125"
                              title={ev.title}
                            >
                              {ev.title}
                            </button>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setSelectedEvent(dayEvents[0])}
                            className="block w-full cursor-pointer px-1 text-left font-mono text-[0.64rem] text-accent/80 hover:underline"
                          >
                            +{dayEvents.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT 4 COLS: UPCOMING EVENTS PANEL */}
          <div className="lg:col-span-4">
            <div className="h-full rounded-[22px] border border-white/12 bg-white/[0.035] p-5 backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h2 className="font-serif text-base font-bold text-white">Upcoming Events</h2>
                  <p className="text-[0.73rem] text-tl/65">
                    Click any event for full schedule details
                  </p>
                </div>
                <CalendarDays className="h-5 w-5 text-gold" />
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="py-12 text-center">
                  <CalendarDays className="mx-auto mb-2.5 h-8 w-8 text-accent/45" />
                  <p className="text-xs font-semibold text-white">No Upcoming Events</p>
                  <p className="mt-1 text-[0.72rem] text-tl/65">
                    Check back soon for new library programs.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingEvents.map((ev) => {
                    const meta = getCategoryMeta(ev.category);
                    const badge = formatDateBadge(ev.event_date);
                    return (
                      <button
                        key={`${ev.id}-upcoming`}
                        type="button"
                        onClick={() => setSelectedEvent(ev)}
                        className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-gold/35 hover:bg-white/[0.06]"
                      >
                        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-white/12 bg-bg1/80">
                          <span className="font-mono text-[0.58rem] font-bold tracking-wider text-accent uppercase">
                            {badge.mon}
                          </span>
                          <span className="font-serif text-sm font-bold leading-none text-white">
                            {badge.day}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              style={{ color: meta.color }}
                              className="font-mono text-[0.64rem] font-bold uppercase"
                            >
                              {meta.shortLabel}
                            </span>
                            {!isAllDayEvent(ev) && ev.start_time && (
                              <span className="font-mono text-[0.64rem] text-white/50">
                                &middot; {formatTime12h(ev.start_time)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-[0.84rem] font-bold text-white">
                            {ev.title}
                          </div>
                          {ev.location && (
                            <div className="mt-0.5 flex items-center gap-1 truncate text-[0.72rem] text-tl/70">
                              <MapPin className="h-3 w-3 shrink-0 text-accent/70" />
                              <span className="truncate">{ev.location}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : sortedAllEvents.length === 0 ? (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-12 text-center backdrop-blur-md">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-accent/55" />
          <h2 className="font-serif text-lg font-bold text-white">No Events Found</h2>
          <p className="mt-1 text-xs text-tl/75">
            Try selecting a different category filter above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedAllEvents.map((ev) => {
            const meta = getCategoryMeta(ev.category);
            const coverUrl = resolveEventCover(ev);
            return (
              <button
                key={`${ev.id}-list`}
                type="button"
                onClick={() => setSelectedEvent(ev)}
                className="flex h-full cursor-pointer flex-col justify-between rounded-[22px] border border-white/10 bg-white/[0.035] p-5 text-left backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-gold/35 hover:bg-white/[0.06]"
              >
                <div>
                  {coverUrl && (
                    <img
                      src={coverUrl}
                      alt={ev.title}
                      className="mb-3 h-36 w-full rounded-xl border border-white/10 object-cover"
                    />
                  )}
                  <span
                    style={{
                      backgroundColor: meta.bg,
                      borderColor: meta.border,
                      color: meta.color,
                    }}
                    className="inline-block rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] font-bold uppercase"
                  >
                    {meta.label}
                  </span>
                  <h3 className="mt-3 text-base font-bold text-white">{ev.title}</h3>
                  {ev.description && (
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-tl/80">
                      {ev.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3 border-t border-white/8 pt-3 font-mono text-[0.72rem] text-white/55">
                  <span>{formatLongDate(ev.event_date)}</span>
                  {!isAllDayEvent(ev) && ev.start_time && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatTime12h(ev.start_time)}
                    </span>
                  )}
                  {ev.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {ev.location}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Read-only Event Detail Modal */}
      <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-[540px] overflow-hidden border border-white/15 bg-bg1/95 p-0 backdrop-blur-2xl">
          {selectedEvent && (() => {
            const meta = getCategoryMeta(selectedEvent.category);
            const coverUrl = resolveEventCover(selectedEvent);
            return (
              <div>
                {/* Hero Image / Fallback Banner */}
                <div className="relative h-48 w-full overflow-hidden border-b border-white/10 sm:h-56">
                  {coverUrl ? (
                    <>
                      <img
                        src={coverUrl}
                        alt={selectedEvent.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg1 via-bg1/30 to-transparent" />
                    </>
                  ) : (
                    <div
                      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-bg2"
                      style={{
                        backgroundImage: `radial-gradient(circle at 50% 45%, ${meta.bg}, rgba(13,22,34,0.95) 75%)`,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-0 opacity-30"
                        style={{
                          backgroundImage:
                            "radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1.2px)",
                          backgroundSize: "20px 20px",
                        }}
                      />
                      <div
                        className="relative flex h-16 w-16 items-center justify-center rounded-2xl border backdrop-blur-md"
                        style={{
                          backgroundColor: meta.bg,
                          borderColor: meta.border,
                          color: meta.color,
                        }}
                      >
                        <CalendarDays className="h-8 w-8" />
                      </div>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg1 via-transparent to-transparent" />
                    </div>
                  )}

                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    aria-label="Close modal"
                    className="absolute right-3.5 top-3.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-bg1/75 text-tl/85 backdrop-blur-md transition hover:border-white/30 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Category Pill Overlay */}
                  <span
                    style={{
                      backgroundColor: meta.bg,
                      borderColor: meta.border,
                      color: meta.color,
                    }}
                    className="absolute bottom-3.5 left-5 inline-block rounded-full border px-3 py-0.5 font-mono text-[0.68rem] font-bold uppercase backdrop-blur-md"
                  >
                    {meta.label}
                  </span>
                </div>

                {/* Modal Body */}
                <div className="p-6">
                  <DialogTitle className="font-serif text-xl font-bold text-white">
                    {selectedEvent.title}
                  </DialogTitle>

                  <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-tl/90">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0 text-gold" />
                      <span className="font-medium text-white">
                        {formatLongDate(selectedEvent.event_date)}
                        {selectedEvent.end_date && selectedEvent.end_date !== selectedEvent.event_date
                          ? ` – ${formatLongDate(selectedEvent.end_date)}`
                          : ""}
                      </span>
                    </div>
                    {!isAllDayEvent(selectedEvent) && selectedEvent.start_time && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-accent" />
                        <span>
                          {formatTime12h(selectedEvent.start_time)}
                          {selectedEvent.end_time ? ` – ${formatTime12h(selectedEvent.end_time)}` : ""}
                        </span>
                      </div>
                    )}
                    {selectedEvent.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-accent2" />
                        <span>{selectedEvent.location}</span>
                      </div>
                    )}
                  </div>

                  {selectedEvent.description && (
                    <p className="mt-4 whitespace-pre-line text-[0.84rem] leading-relaxed text-tl/85">
                      {selectedEvent.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </MemberShell>
  );
}
