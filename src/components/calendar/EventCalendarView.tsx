"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  MapPin,
  RotateCcw,
  Star,
  Tags,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { apiMutate, swrPrivateConfig } from "@/lib/api";
import {
  type CalendarEventRow,
  type CalendarViewMode,
  type EventCategoryRow,
  type EventEditScope,
  addDays,
  buildCalendarHash,
  buildCategoryList,
  computeEventStats,
  diffDays,
  eventInstanceKey,
  formatDateBadge,
  formatTime12h,
  getCategoryMeta,
  getManilaNowParts,
  getVisibleDateRange,
  isAllDayEvent,
  parseCalendarHash,
} from "@/components/calendar/calendar-utils";
import { CalendarGrid, CategoryIcon } from "@/components/calendar/CalendarGrid";
import {
  CategoryManagerModal,
  DeleteEventModal,
  EventDetailModal,
  EventFormModal,
  type EventFormPayload,
} from "@/components/calendar/CalendarModals";
import "@/components/calendar/calendar.css";

interface ToastMsg {
  id: number;
  text: string;
  tone: "success" | "error";
}

export interface EventCalendarViewProps {
  role?: "admin" | "librarian";
  subtitle?: string;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canReschedule?: boolean;
  canManageCategories?: boolean;
  canUploadCover?: boolean;
}

export function EventCalendarView({
  role = "admin",
  subtitle = "Hover any date to add an event or drag events to reschedule · Philippines Standard Time (UTC+8)",
  canCreate = true,
  canEdit = true,
  canDelete = true,
  canReschedule = true,
  canManageCategories = role === "admin",
  canUploadCover = true,
}: EventCalendarViewProps) {
  const todayStr = useMemo(() => getManilaNowParts().dateStr, []);

  const [anchorDate, setAnchorDate] = useState<string>(todayStr);
  const [view, setView] = useState<CalendarViewMode>("month");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventRow | null>(null);
  const [formInitialDate, setFormInitialDate] = useState<string>(todayStr);
  const [formInitialStart, setFormInitialStart] = useState<string | undefined>(undefined);

  const [detailEvent, setDetailEvent] = useState<CalendarEventRow | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<CalendarEventRow | null>(null);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const visibleRange = useMemo(
    () => getVisibleDateRange(anchorDate, view),
    [anchorDate, view]
  );

  // Range-expanded events for the visible calendar grid
  const {
    data: rangeData,
    error: rangeError,
    isLoading: rangeLoading,
    mutate: mutateRange,
  } = useSWR<{ rows?: CalendarEventRow[]; truncated?: boolean }>(
    `/api/admin/data?resource=events&from=${encodeURIComponent(visibleRange.from)}&to=${encodeURIComponent(visibleRange.to)}`,
    swrPrivateConfig
  );

  // Full list for the Events Summary & Next Upcoming Events panel
  const {
    data: allData,
    isLoading: allLoading,
    mutate: mutateAll,
  } = useSWR<{ rows?: CalendarEventRow[] }>(
    "/api/admin/data?resource=events",
    swrPrivateConfig
  );

  // Live categories
  const { data: catData, mutate: mutateCategories } = useSWR<{ rows?: EventCategoryRow[] }>(
    "/api/admin/data?resource=event_categories",
    swrPrivateConfig
  );

  const categoryRows = useMemo(() => catData?.rows ?? [], [catData?.rows]);
  const categories = useMemo(() => buildCategoryList(categoryRows), [categoryRows]);

  // Sync from URL hash on mount and browser back/forward
  useEffect(() => {
    const syncFromHash = () => {
      const parsed = parseCalendarHash(window.location.hash, todayStr);
      setAnchorDate(parsed.dateStr);
      setView(parsed.view);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [todayStr]);

  const updateNav = useCallback((nextDate: string, nextView: CalendarViewMode) => {
    setAnchorDate(nextDate);
    setView(nextView);
    const nextHash = buildCalendarHash(nextDate, nextView);
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((text: string, tone: ToastMsg["tone"] = "success") => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  const visibleEvents = useMemo(() => rangeData?.rows ?? [], [rangeData?.rows]);
  const summaryEvents = useMemo(
    () => allData?.rows ?? visibleEvents,
    [allData?.rows, visibleEvents]
  );

  const filteredEvents = useMemo(() => {
    if (!activeCategory) return visibleEvents;
    return visibleEvents.filter(
      (ev) => getCategoryMeta(ev.category, categories).key === activeCategory
    );
  }, [visibleEvents, activeCategory, categories]);

  const stats = useMemo(
    () => computeEventStats(summaryEvents, todayStr),
    [summaryEvents, todayStr]
  );

  const refreshAll = async () => {
    await Promise.all([mutateRange(), mutateAll()]);
  };

  const handleOpenAdd = (dateStr: string, defaultStart?: string) => {
    if (!canCreate) return;
    setEditingEvent(null);
    setFormInitialDate(dateStr);
    setFormInitialStart(defaultStart);
    setFormOpen(true);
  };

  const handleOpenEdit = (ev: CalendarEventRow) => {
    if (!canEdit) return;
    setEditingEvent(ev);
    setFormInitialDate((ev.event_date || todayStr).slice(0, 10));
    setFormInitialStart(undefined);
    setFormOpen(true);
  };

  const handleSaveEvent = async (payload: EventFormPayload) => {
    setMutating(true);
    try {
      const isEdit = Boolean(payload.id);
      await apiMutate("/api/admin/data", {
        method: isEdit ? "PUT" : "POST",
        body: {
          resource: "events",
          action: isEdit ? "update" : "create",
          id: payload.id ?? undefined,
          payload: {
            title: payload.title,
            event_date: payload.event_date,
            end_date: payload.end_date,
            category: payload.category,
            start_time: payload.start_time,
            end_time: payload.end_time,
            all_day: payload.all_day,
            audience: payload.audience,
            location: payload.location,
            description: payload.description,
            cover_image: payload.cover_image,
            reminders: payload.reminders,
            recurrence: payload.recurrence,
            scope: payload.scope,
            occurrence_date: payload.occurrence_date,
          },
        },
      });
      await refreshAll();
      setFormOpen(false);
      showToast(`Event "${payload.title}" ${isEdit ? "updated!" : "added!"}`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save.", "error");
    } finally {
      setMutating(false);
    }
  };

  const handleDropReschedule = async (
    ev: CalendarEventRow,
    targetDate: string,
    targetStartTime?: string
  ) => {
    if (!canReschedule) return;
    const oldStart = (ev.event_date || "").slice(0, 10);
    const oldEnd = ev.end_date ? ev.end_date.slice(0, 10) : null;
    const span = oldEnd && oldStart ? Math.max(0, diffDays(oldStart, oldEnd)) : 0;
    const nextEndDate = span > 0 ? addDays(targetDate, span) : null;

    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "events",
          action: "reschedule",
          id: ev.master_id ?? ev.id,
          payload: {
            event_date: targetDate,
            end_date: nextEndDate,
            start_time: targetStartTime ?? ev.start_time ?? null,
            end_time: ev.end_time ?? null,
            all_day: targetStartTime ? false : isAllDayEvent(ev),
            scope: ev.is_recurring ? "this" : "all",
            occurrence_date: ev.occurrence_date ?? oldStart,
          },
        },
      });
      await refreshAll();
      showToast(`Rescheduled "${ev.title}" to ${targetDate}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reschedule event.", "error");
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmDelete = async (ev: CalendarEventRow, scope: EventEditScope) => {
    if (!canDelete) return;
    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "DELETE",
        body: {
          resource: "events",
          action: "delete",
          id: ev.master_id ?? ev.id,
          payload: {
            scope,
            occurrence_date: ev.occurrence_date ?? ev.event_date,
          },
        },
      });
      await refreshAll();
      setDeleteEvent(null);
      showToast("Event deleted.", "error");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete.", "error");
    } finally {
      setMutating(false);
    }
  };

  const handleCreateCategory = async (slug: string, name: string, color: string) => {
    if (!canManageCategories) return;
    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "POST",
        body: {
          resource: "event_categories",
          action: "create",
          payload: { slug, name, color },
        },
      });
      await mutateCategories();
      showToast(`Category "${name}" created.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create category.", "error");
    } finally {
      setMutating(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!canManageCategories) return;
    setMutating(true);
    try {
      await apiMutate("/api/admin/data", {
        method: "DELETE",
        body: {
          resource: "event_categories",
          action: "delete",
          id,
          payload: {},
        },
      });
      await mutateCategories();
      showToast("Category deleted.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Cannot delete category.", "error");
    } finally {
      setMutating(false);
    }
  };

  return (
    <StaffShell title="Event Calendar" role={role}>
      <div className="admin-calendar-page">
        {/* Page Header */}
        <header className="cal-page-header">
          <div>
            <div className="cal-eyebrow">Library Management</div>
            <h1 className="cal-title">
              Event <span>Calendar</span>
            </h1>
            <p className="cal-subtitle">{subtitle}</p>
          </div>

          <div className="cal-stat-chips" aria-label="Calendar quick counts">
            <div className="cal-stat-chip">
              <div className="cal-stat-icon sci-green">
                <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <div className="cal-stat-lbl">This Month</div>
                <div className="cal-stat-val">{allLoading ? "—" : stats.thisMonth}</div>
              </div>
            </div>

            <div className="cal-stat-chip">
              <div className="cal-stat-icon sci-blue">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <div className="cal-stat-lbl">This Week</div>
                <div className="cal-stat-val">{allLoading ? "—" : stats.thisWeek}</div>
              </div>
            </div>

            <div className="cal-stat-chip">
              <div className="cal-stat-icon sci-yellow">
                <Star className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <div className="cal-stat-lbl">Upcoming</div>
                <div className="cal-stat-val">{allLoading ? "—" : stats.upcoming}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        {rangeError && (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255, 99, 99, 0.35)",
              background: "rgba(255, 99, 99, 0.12)",
              color: "var(--cal-danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              fontSize: "0.84rem",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              Could not load events. Check your connection and try again.
            </span>
            <button
              type="button"
              className="cal-btn"
              style={{ minHeight: 44, fontSize: "0.74rem" }}
              onClick={() => void refreshAll()}
            >
              Retry
            </button>
          </div>
        )}

        {/* Calendar Grid Shell */}
        <CalendarGrid
          events={filteredEvents}
          categories={categories}
          anchorDate={anchorDate}
          todayStr={todayStr}
          view={view}
          loading={rangeLoading}
          onChangeAnchor={(d) => updateNav(d, view)}
          onChangeView={(v) => updateNav(anchorDate, v)}
          onAddEventOnDate={handleOpenAdd}
          onSelectEvent={(ev) => setDetailEvent(ev)}
          onDropReschedule={handleDropReschedule}
          canCreate={canCreate}
          canReschedule={canReschedule}
        />

        {/* Category Legend & Filter */}
        <div className="cal-legend" role="group" aria-label="Filter events by category">
          {categories.map((cat) => {
            const isSelected = activeCategory === cat.key;
            const isDimmed = activeCategory !== null && !isSelected;
            return (
              <button
                key={cat.key}
                type="button"
                className={`cal-legend-btn ${isSelected ? "active" : ""} ${isDimmed ? "dimmed" : ""}`}
                aria-pressed={isSelected}
                onClick={() => setActiveCategory((cur) => (cur === cat.key ? null : cat.key))}
              >
                <span
                  className="cal-legend-dot"
                  style={{ background: cat.color }}
                  aria-hidden="true"
                />
                <CategoryIcon category={cat.key} className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            className="cal-legend-btn"
            style={{ fontStyle: "italic" }}
            onClick={() => setActiveCategory(null)}
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Show all
          </button>

          {canManageCategories && (
            <button
              type="button"
              className="cal-legend-btn"
              style={{ marginLeft: "auto" }}
              onClick={() => setCatManagerOpen(true)}
            >
              <Tags className="h-3.5 w-3.5" aria-hidden="true" />
              Manage Categories
            </button>
          )}
        </div>

        {/* Events Summary Panel */}
        <section className="cal-summary" aria-label="Events summary">
          <div className="cal-summary-head">
            <div className="cal-summary-icon">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--cal-tl)" }}>
                Events Summary
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--cal-text-faint)", marginTop: 1 }}>
                Overview of all scheduled library events
              </div>
            </div>
          </div>

          <div className="cal-summary-body">
            <div className="cal-sum-stats">
              <div className="cal-sum-stat">
                <div className="cal-sum-num" style={{ color: "var(--cal-accent)" }}>
                  {allLoading ? "—" : stats.total}
                </div>
                <div className="cal-sum-lbl">Total</div>
              </div>
              <div className="cal-sum-stat">
                <div className="cal-sum-num" style={{ color: "var(--cal-accent2)" }}>
                  {allLoading ? "—" : stats.thisMonth}
                </div>
                <div className="cal-sum-lbl">This Month</div>
              </div>
              <div className="cal-sum-stat">
                <div className="cal-sum-num" style={{ color: "var(--cal-accent3)" }}>
                  {allLoading ? "—" : stats.thisWeek}
                </div>
                <div className="cal-sum-lbl">This Week</div>
              </div>
              <div className="cal-sum-stat">
                <div className="cal-sum-num" style={{ color: "#c882ff" }}>
                  {allLoading ? "—" : stats.upcoming}
                </div>
                <div className="cal-sum-lbl">Upcoming</div>
              </div>
            </div>

            <div className="cal-upcoming-head">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              Next Upcoming Events
            </div>

            {stats.nextUpcoming.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "30px 0",
                  color: "var(--cal-text-faint)",
                  fontSize: "0.85rem",
                }}
              >
                <CalendarX className="mx-auto mb-2 h-8 w-8 opacity-55" aria-hidden="true" />
                No upcoming events scheduled
              </div>
            ) : (
              <div className="cal-upcoming-list">
                {stats.nextUpcoming.map((ev) => {
                  const badge = formatDateBadge(ev.event_date);
                  const cat = getCategoryMeta(ev.category, categories);
                  const timeStr = isAllDayEvent(ev) ? "All day" : formatTime12h(ev.start_time);
                  return (
                    <button
                      key={eventInstanceKey(ev)}
                      type="button"
                      className="cal-upcoming-item"
                      onClick={() => setDetailEvent(ev)}
                    >
                      <div
                        className="cal-date-badge"
                        style={{ background: cat.bg, borderColor: cat.border }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: "1.02rem",
                            color: cat.color,
                            lineHeight: 1,
                          }}
                        >
                          {badge.day}
                        </span>
                        <span
                          style={{
                            fontSize: "0.58rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: cat.color,
                            opacity: 0.8,
                            marginTop: 2,
                          }}
                        >
                          {badge.mon}
                        </span>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.87rem",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {ev.title}
                        </div>
                        <div
                          style={{
                            fontSize: "0.73rem",
                            color: "var(--cal-text-muted)",
                            marginTop: 3,
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <CategoryIcon category={cat.key} className="h-3 w-3" />
                            {cat.shortLabel}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {timeStr}
                          </span>
                          {ev.location && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <MapPin className="h-3 w-3" aria-hidden="true" />
                              {ev.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 opacity-40 shrink-0" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modals */}
      {(canCreate || canEdit) && (
        <EventFormModal
          open={formOpen}
          editingEvent={editingEvent}
          categories={categories}
          initialDate={formInitialDate}
          initialStartTime={formInitialStart}
          busy={mutating}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSaveEvent}
          canUploadCover={canUploadCover}
        />
      )}

      <EventDetailModal
        event={detailEvent}
        categories={categories}
        onClose={() => setDetailEvent(null)}
        onEdit={handleOpenEdit}
        onDelete={(ev) => setDeleteEvent(ev)}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      {canDelete && (
        <DeleteEventModal
          event={deleteEvent}
          busy={mutating}
          onClose={() => setDeleteEvent(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {canManageCategories && (
        <CategoryManagerModal
          open={catManagerOpen}
          rows={categoryRows}
          busy={mutating}
          onClose={() => setCatManagerOpen(false)}
          onCreate={handleCreateCategory}
          onDelete={handleDeleteCategory}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="cal-toast"
          role="status"
          aria-live="polite"
          style={{
            borderLeft: `3px solid ${toast.tone === "success" ? "#48c78e" : "#ff6363"}`,
          }}
        >
          {toast.tone === "success" ? (
            <CheckCircle2 className="h-4 w-4" style={{ color: "#48c78e" }} aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4" style={{ color: "#ff6363" }} aria-hidden="true" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </StaffShell>
  );
}
