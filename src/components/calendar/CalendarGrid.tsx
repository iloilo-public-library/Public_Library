"use client";

import { useMemo, useRef, useState } from "react";
import {
  Ban,
  BookOpen,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Palette,
  Plus,
  Repeat,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  type CalendarEventRow,
  type CalendarViewMode,
  type CategoryMeta,
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekDays,
  eventInstanceKey,
  eventOccursOnDate,
  formatAccessibleDay,
  formatLongDate,
  formatMonthTitle,
  formatTime12h,
  formatWeekRangeTitle,
  getCategoryMeta,
  isAllDayEvent,
  normalizeHHMM,
  parseDateStr,
  timeToMinutes,
} from "./calendar-utils";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  switch (category) {
    case "workshop":
      return <BookOpen className={className} aria-hidden="true" />;
    case "holiday":
      return <Sparkles className={className} aria-hidden="true" />;
    case "exhibit":
      return <Palette className={className} aria-hidden="true" />;
    case "closure":
      return <Ban className={className} aria-hidden="true" />;
    default:
      return <Tag className={className} aria-hidden="true" />;
  }
}

interface CalendarGridProps {
  events: CalendarEventRow[];
  categories: CategoryMeta[];
  anchorDate: string;
  todayStr: string;
  view: CalendarViewMode;
  loading: boolean;
  onChangeAnchor: (dateStr: string) => void;
  onChangeView: (view: CalendarViewMode) => void;
  onAddEventOnDate: (dateStr: string, defaultStartTime?: string) => void;
  onSelectEvent: (ev: CalendarEventRow) => void;
  onDropReschedule: (ev: CalendarEventRow, targetDate: string, targetStartTime?: string) => void;
  canCreate?: boolean;
  canReschedule?: boolean;
}

export function CalendarGrid({
  events,
  categories,
  anchorDate,
  todayStr,
  view,
  loading,
  onChangeAnchor,
  onChangeView,
  onAddEventOnDate,
  onSelectEvent,
  onDropReschedule,
  canCreate = true,
  canReschedule = true,
}: CalendarGridProps) {
  const [overflowDate, setOverflowDate] = useState<string | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEventRow | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const weeks = useMemo(() => buildMonthGrid(anchorDate, todayStr), [anchorDate, todayStr]);
  const weekDays = useMemo(() => buildWeekDays(anchorDate, todayStr), [anchorDate, todayStr]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>();
    const allDates = new Set<string>();
    for (const row of weeks) {
      for (const cell of row) allDates.add(cell.dateStr);
    }
    for (const wd of weekDays) allDates.add(wd.dateStr);
    allDates.add(anchorDate);

    for (const ds of allDates) {
      const list = events
        .filter((ev) => eventOccursOnDate(ev, ds))
        .sort((a, b) => normalizeHHMM(a.start_time).localeCompare(normalizeHHMM(b.start_time)));
      if (list.length) map.set(ds, list);
    }
    return map;
  }, [events, weeks, weekDays, anchorDate]);

  const rangeTitle =
    view === "month"
      ? formatMonthTitle(anchorDate)
      : view === "week"
        ? formatWeekRangeTitle(anchorDate)
        : view === "day"
          ? formatLongDate(anchorDate)
          : formatMonthTitle(anchorDate);

  const handlePrev = () => {
    if (view === "month" || view === "list") onChangeAnchor(addMonths(anchorDate, -1));
    else if (view === "week") onChangeAnchor(addDays(anchorDate, -7));
    else onChangeAnchor(addDays(anchorDate, -1));
  };

  const handleNext = () => {
    if (view === "month" || view === "list") onChangeAnchor(addMonths(anchorDate, 1));
    else if (view === "week") onChangeAnchor(addDays(anchorDate, 7));
    else onChangeAnchor(addDays(anchorDate, 1));
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, dateStr: string) => {
    let targetDate: string | null = null;
    if (e.key === "ArrowLeft") targetDate = addDays(dateStr, -1);
    else if (e.key === "ArrowRight") targetDate = addDays(dateStr, 1);
    else if (e.key === "ArrowUp") targetDate = addDays(dateStr, -7);
    else if (e.key === "ArrowDown") targetDate = addDays(dateStr, 7);
    else if (e.key === "PageUp") {
      e.preventDefault();
      onChangeAnchor(addMonths(anchorDate, -1));
      return;
    } else if (e.key === "PageDown") {
      e.preventDefault();
      onChangeAnchor(addMonths(anchorDate, 1));
      return;
    } else if (e.key === "Enter") {
      if (canCreate) {
        e.preventDefault();
        onAddEventOnDate(dateStr);
      }
      return;
    }

    if (targetDate) {
      e.preventDefault();
      const targetEl = cellRefs.current[targetDate];
      if (targetEl) targetEl.focus();
      else onChangeAnchor(targetDate);
    }
  };

  const agendaGroups = useMemo(() => {
    const { year, month } = parseDateStr(anchorDate);
    const grouped = new Map<string, CalendarEventRow[]>();
    const monthEvents = events
      .filter((ev) => {
        const ds = (ev.event_date || "").slice(0, 10);
        if (!ds) return false;
        const p = parseDateStr(ds);
        return p.year === year && p.month === month;
      })
      .sort((a, b) => {
        const cmp = (a.event_date || "").localeCompare(b.event_date || "");
        if (cmp !== 0) return cmp;
        return normalizeHHMM(a.start_time).localeCompare(normalizeHHMM(b.start_time));
      });

    for (const ev of monthEvents) {
      const ds = (ev.event_date || "").slice(0, 10);
      const arr = grouped.get(ds) ?? [];
      arr.push(ev);
      grouped.set(ds, arr);
    }
    return Array.from(grouped.entries());
  }, [events, anchorDate]);

  const mobileStripDays = useMemo(() => {
    const list: { dateStr: string; day: number; dow: string; count: number }[] = [];
    for (const row of weeks) {
      for (const cell of row) {
        if (!cell.inCurrentMonth) continue;
        const p = parseDateStr(cell.dateStr);
        const dow = WEEKDAY_LABELS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()];
        list.push({
          dateStr: cell.dateStr,
          day: cell.day,
          dow,
          count: eventsByDate.get(cell.dateStr)?.length ?? 0,
        });
      }
    }
    return list;
  }, [weeks, eventsByDate]);

  const overflowEvents = overflowDate ? eventsByDate.get(overflowDate) ?? [] : [];

  const renderAgenda = () => (
    <div className="cal-list-wrap">
      {agendaGroups.length === 0 ? (
        <div
          style={{
            padding: "42px 20px",
            textAlign: "center",
            color: "var(--cal-text-muted)",
            fontSize: "0.86rem",
          }}
        >
          <Calendar className="mx-auto mb-2 h-8 w-8 opacity-45" aria-hidden="true" />
          No events scheduled for {formatMonthTitle(anchorDate)}.
        </div>
      ) : (
        agendaGroups.map(([ds, list]) => (
          <div key={ds}>
            <div className="cal-list-day-head">
              <span>{formatLongDate(ds)}</span>
              {canCreate && (
                <button
                  type="button"
                  className="cal-btn"
                  style={{ minHeight: 32, minWidth: 32, padding: "0 10px", fontSize: "0.68rem" }}
                  onClick={() => onAddEventOnDate(ds)}
                >
                  <Plus className="h-3 w-3" aria-hidden="true" /> Add
                </button>
              )}
            </div>
            {list.map((ev) => {
              const cat = getCategoryMeta(ev.category, categories);
              const timeStr = isAllDayEvent(ev)
                ? "All day"
                : `${formatTime12h(ev.start_time)}${ev.end_time ? ` – ${formatTime12h(ev.end_time)}` : ""}`;
              return (
                <button
                  key={eventInstanceKey(ev)}
                  type="button"
                  className="cal-list-item"
                  onClick={() => onSelectEvent(ev)}
                >
                  <span className="cal-list-time">{timeStr}</span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: cat.bg,
                      border: `1px solid ${cat.border}`,
                      color: cat.color,
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    <CategoryIcon category={cat.key} className="h-3 w-3" />
                    {cat.shortLabel}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontWeight: 600,
                      fontSize: "0.86rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {ev.is_recurring && <Repeat className="h-3.5 w-3.5 opacity-65" aria-hidden="true" />}
                    {ev.title}
                  </span>
                  {ev.location && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--cal-text-muted)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {ev.location}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );

  const renderTimeGrid = (days: typeof weekDays) => {
    const colTemplate = `72px repeat(${days.length}, minmax(110px, 1fr))`;
    return (
      <div className="cal-time-wrap">
        <div className="cal-time-head" style={{ gridTemplateColumns: colTemplate }}>
          <div className="cal-time-head-cell">Time</div>
          {days.map((d) => {
            const p = parseDateStr(d.dateStr);
            const dow = WEEKDAY_LABELS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()];
            return (
              <div key={d.dateStr} className={`cal-time-head-cell ${d.isToday ? "today" : ""}`}>
                {dow} {d.day}
              </div>
            );
          })}
        </div>

        <div className="cal-time-row" style={{ gridTemplateColumns: colTemplate }}>
          <div className="cal-time-label">All Day</div>
          {days.map((d) => {
            const allDay = (eventsByDate.get(d.dateStr) ?? []).filter(isAllDayEvent);
            const slotKey = `allday:${d.dateStr}`;
            return (
              <div
                key={d.dateStr}
                className="cal-time-slot"
                style={dragOverKey === slotKey ? { background: "rgba(72, 199, 142, 0.14)" } : undefined}
                onClick={() => {
                  if (canCreate) onAddEventOnDate(d.dateStr);
                }}
                onDragOver={(e) => {
                  if (!canReschedule) return;
                  e.preventDefault();
                  setDragOverKey(slotKey);
                }}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={(e) => {
                  if (!canReschedule) return;
                  e.preventDefault();
                  setDragOverKey(null);
                  if (draggedEvent) {
                    onDropReschedule(draggedEvent, d.dateStr);
                    setDraggedEvent(null);
                  }
                }}
              >
                {allDay.map((ev) => {
                  const cat = getCategoryMeta(ev.category, categories);
                  return (
                    <button
                      key={eventInstanceKey(ev)}
                      type="button"
                      draggable={canReschedule}
                      onDragStart={() => {
                        if (canReschedule) setDraggedEvent(ev);
                      }}
                      onDragEnd={() => {
                        setDraggedEvent(null);
                        setDragOverKey(null);
                      }}
                      className="cal-event-chip"
                      style={{ "--chip-color": cat.color, "--chip-bg": cat.bg } as React.CSSProperties}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                    >
                      <CategoryIcon category={cat.key} className="h-3 w-3 shrink-0" />
                      {ev.is_recurring && <Repeat className="h-2.5 w-2.5 shrink-0 opacity-75" aria-hidden="true" />}
                      <span className="cal-event-chip-text">{ev.title}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {HOURS.map((hr) => {
          const hh = `${String(hr).padStart(2, "0")}:00`;
          return (
            <div key={hr} className="cal-time-row" style={{ gridTemplateColumns: colTemplate }}>
              <div className="cal-time-label">{formatTime12h(hh)}</div>
              {days.map((d) => {
                const slotEvents = (eventsByDate.get(d.dateStr) ?? []).filter((ev) => {
                  if (isAllDayEvent(ev)) return false;
                  const mins = timeToMinutes(ev.start_time);
                  return Math.floor(mins / 60) === hr;
                });
                const slotKey = `${d.dateStr}:${hh}`;
                return (
                  <div
                    key={d.dateStr}
                    className="cal-time-slot"
                    style={dragOverKey === slotKey ? { background: "rgba(72, 199, 142, 0.14)" } : undefined}
                    onClick={() => {
                      if (canCreate) onAddEventOnDate(d.dateStr, hh);
                    }}
                    onDragOver={(e) => {
                      if (!canReschedule) return;
                      e.preventDefault();
                      setDragOverKey(slotKey);
                    }}
                    onDragLeave={() => setDragOverKey(null)}
                    onDrop={(e) => {
                      if (!canReschedule) return;
                      e.preventDefault();
                      setDragOverKey(null);
                      if (draggedEvent) {
                        onDropReschedule(draggedEvent, d.dateStr, hh);
                        setDraggedEvent(null);
                      }
                    }}
                  >
                    {slotEvents.map((ev) => {
                      const cat = getCategoryMeta(ev.category, categories);
                      return (
                        <button
                          key={eventInstanceKey(ev)}
                          type="button"
                          draggable={canReschedule}
                          onDragStart={() => {
                            if (canReschedule) setDraggedEvent(ev);
                          }}
                          onDragEnd={() => {
                            setDraggedEvent(null);
                            setDragOverKey(null);
                          }}
                          className="cal-event-chip"
                          style={{ "--chip-color": cat.color, "--chip-bg": cat.bg } as React.CSSProperties}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(ev);
                          }}
                          aria-label={`${ev.title}, ${cat.label}, ${formatTime12h(ev.start_time)}`}
                        >
                          <CategoryIcon category={cat.key} className="h-3 w-3 shrink-0" />
                          {ev.is_recurring && <Repeat className="h-2.5 w-2.5 shrink-0 opacity-75" aria-hidden="true" />}
                          <span className="cal-event-chip-text">{ev.title}</span>
                          <span className="cal-event-chip-time">{formatTime12h(ev.start_time)}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="cal-shell">
      <div className="cal-toolbar">
        <div className="cal-toolbar-group">
          <div className="cal-btn-group">
            <button type="button" className="cal-btn" onClick={handlePrev} aria-label="Previous period">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="cal-btn" onClick={handleNext} aria-label="Next period">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="cal-btn cal-btn-today"
            onClick={() => onChangeAnchor(todayStr)}
          >
            Today
          </button>
          {canCreate && (
            <button
              type="button"
              className="cal-btn cal-btn-add"
              onClick={() => onAddEventOnDate(anchorDate)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add Event
            </button>
          )}
        </div>

        <h2 className="cal-range-title" aria-live="polite">
          {rangeTitle}
        </h2>

        <div className="cal-btn-group" role="group" aria-label="Calendar view">
          {(
            [
              { key: "month", label: "Month" },
              { key: "week", label: "Week" },
              { key: "day", label: "Day" },
              { key: "list", label: "List" },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              className={`cal-btn ${view === v.key ? "active" : ""}`}
              aria-pressed={view === v.key}
              onClick={() => onChangeView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compact mobile month strip */}
      <div className="cal-mobile-strip" aria-label="Days in month">
        {mobileStripDays.map((d) => (
          <button
            key={d.dateStr}
            type="button"
            className={`cal-strip-day ${d.dateStr === anchorDate ? "active" : ""}`}
            onClick={() => onChangeAnchor(d.dateStr)}
          >
            <span style={{ fontSize: "0.64rem", opacity: 0.7 }}>{d.dow}</span>
            <span>{d.day}</span>
            {d.count > 0 && (
              <span
                style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--cal-accent2)" }}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, padding: "8px 0" }}
          aria-label="Loading calendar"
        >
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ height: 76, borderRadius: 10, background: "rgba(159, 193, 225, 0.1)" }} />
          ))}
        </div>
      ) : (
        <>
          <div className="cal-desktop-grid">
            {view === "month" && (
              <div className="cal-month-grid" role="grid" aria-label={rangeTitle}>
                <div className="cal-weekday-row" role="row">
                  {WEEKDAY_LABELS.map((wd) => (
                    <div key={wd} className="cal-weekday-cell" role="columnheader">
                      {wd}
                    </div>
                  ))}
                </div>

                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="cal-week-row" role="row">
                    {week.map((cell) => {
                      const dayEvents = eventsByDate.get(cell.dateStr) ?? [];
                      const visible = dayEvents.slice(0, 3);
                      const hiddenCount = dayEvents.length - visible.length;
                      const ariaDay = `${formatAccessibleDay(cell.dateStr)}, ${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}`;
                      const isDragOver = dragOverKey === cell.dateStr;

                      return (
                        <div
                          key={cell.dateStr}
                          ref={(el) => {
                            cellRefs.current[cell.dateStr] = el;
                          }}
                          role="gridcell"
                          tabIndex={cell.dateStr === anchorDate ? 0 : -1}
                          aria-label={ariaDay}
                          aria-current={cell.isToday ? "date" : undefined}
                          className={`cal-day-cell ${cell.inCurrentMonth ? "" : "outside"} ${cell.isToday ? "today" : ""}`}
                          style={isDragOver ? { background: "rgba(72, 199, 142, 0.16)" } : undefined}
                          onKeyDown={(e) => handleCellKeyDown(e, cell.dateStr)}
                          onClick={() => {
                            if (canCreate) onAddEventOnDate(cell.dateStr);
                          }}
                          onDragOver={(e) => {
                            if (!canReschedule) return;
                            e.preventDefault();
                            setDragOverKey(cell.dateStr);
                          }}
                          onDragLeave={() => setDragOverKey(null)}
                          onDrop={(e) => {
                            if (!canReschedule) return;
                            e.preventDefault();
                            setDragOverKey(null);
                            if (draggedEvent && draggedEvent.event_date !== cell.dateStr) {
                              onDropReschedule(draggedEvent, cell.dateStr);
                            }
                            setDraggedEvent(null);
                          }}
                        >
                          <div className="cal-day-head">
                            <span className="cal-day-num">{cell.day}</span>
                          </div>

                          {visible.map((ev) => {
                            const cat = getCategoryMeta(ev.category, categories);
                            const t = isAllDayEvent(ev) ? "All day" : formatTime12h(ev.start_time);
                            return (
                              <button
                                key={eventInstanceKey(ev)}
                                type="button"
                                draggable={canReschedule}
                                onDragStart={(e) => {
                                  if (!canReschedule) return;
                                  e.stopPropagation();
                                  setDraggedEvent(ev);
                                }}
                                onDragEnd={() => {
                                  setDraggedEvent(null);
                                  setDragOverKey(null);
                                }}
                                className="cal-event-chip"
                                style={{ "--chip-color": cat.color, "--chip-bg": cat.bg } as React.CSSProperties}
                                aria-label={`${ev.title}, ${cat.label}, ${t}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectEvent(ev);
                                }}
                              >
                                <CategoryIcon category={cat.key} className="h-3 w-3 shrink-0" />
                                {ev.is_recurring && (
                                  <Repeat className="h-2.5 w-2.5 shrink-0 opacity-75" aria-hidden="true" />
                                )}
                                <span className="cal-event-chip-text">{ev.title}</span>
                                {!isAllDayEvent(ev) && (
                                  <span className="cal-event-chip-time">{t}</span>
                                )}
                              </button>
                            );
                          })}

                          {hiddenCount > 0 && (
                            <button
                              type="button"
                              className="cal-more-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOverflowDate(cell.dateStr);
                              }}
                            >
                              +{hiddenCount} more
                            </button>
                          )}

                          {canCreate && (
                            <button
                              type="button"
                              className="cal-day-add-btn"
                              aria-label={`Add event on ${formatAccessibleDay(cell.dateStr)}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddEventOnDate(cell.dateStr);
                              }}
                            >
                              <Plus className="h-3 w-3" aria-hidden="true" /> Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {view === "week" && renderTimeGrid(weekDays)}
            {view === "day" &&
              renderTimeGrid([
                {
                  dateStr: anchorDate,
                  day: parseDateStr(anchorDate).day,
                  inCurrentMonth: true,
                  isToday: anchorDate === todayStr,
                },
              ])}
            {view === "list" && renderAgenda()}
          </div>

          <div className="sm:hidden">{renderAgenda()}</div>
        </>
      )}

      {overflowDate && (
        <div
          className="cal-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOverflowDate(null);
          }}
        >
          <div
            className="cal-modal-dialog cal-modal-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cal-overflow-title"
          >
            <div className="cal-modal-header">
              <h3 id="cal-overflow-title" className="cal-modal-title">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {formatLongDate(overflowDate)}
              </h3>
              <button
                type="button"
                className="cal-btn"
                style={{ minWidth: 36, minHeight: 36, padding: 0 }}
                onClick={() => setOverflowDate(null)}
                aria-label="Close day events"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="cal-modal-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {overflowEvents.map((ev) => {
                const cat = getCategoryMeta(ev.category, categories);
                const t = isAllDayEvent(ev)
                  ? "All day"
                  : `${formatTime12h(ev.start_time)}${ev.end_time ? ` – ${formatTime12h(ev.end_time)}` : ""}`;
                return (
                  <button
                    key={eventInstanceKey(ev)}
                    type="button"
                    className="cal-event-chip"
                    style={{
                      "--chip-color": cat.color,
                      "--chip-bg": cat.bg,
                      padding: "8px 10px",
                      fontSize: "0.82rem",
                    } as React.CSSProperties}
                    onClick={() => {
                      setOverflowDate(null);
                      onSelectEvent(ev);
                    }}
                  >
                    <CategoryIcon category={cat.key} className="h-3.5 w-3.5 shrink-0" />
                    <span className="cal-event-chip-text">{ev.title}</span>
                    <span className="cal-event-chip-time">
                      <Clock className="inline h-3 w-3 mr-1" aria-hidden="true" />
                      {t}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
