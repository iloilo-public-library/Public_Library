"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Globe,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  Tags,
  Trash2,
  Type,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  type CalendarEventRow,
  type CategoryMeta,
  type EventCategoryRow,
  type EventEditScope,
  type RecurrenceFreq,
  REMINDER_OPTIONS,
  WEEKDAY_LABELS,
  formatLongDate,
  formatTime12h,
  getCategoryMeta,
  isAllDayEvent,
  normalizeHHMM,
} from "./calendar-utils";
import { CategoryIcon } from "./CalendarGrid";

function useModalTrap(isOpen: boolean, onClose: () => void, busy: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ onClose, busy });
  stateRef.current = { onClose, busy };

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !stateRef.current.busy) {
        e.preventDefault();
        stateRef.current.onClose();
        return;
      }
      if (e.key === "Tab" && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      prev?.focus();
    };
  }, [isOpen]);

  return ref;
}

export interface EventFormPayload {
  id: number | null;
  title: string;
  event_date: string;
  end_date: string | null;
  category: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  audience: "all" | "members" | "staff";
  location: string;
  description: string;
  cover_image: string | null;
  reminders: number[];
  recurrence: {
    freq: RecurrenceFreq;
    interval: number;
    weekdays?: number[] | null;
    day_of_month?: number | null;
    until?: string | null;
    count?: number | null;
  } | null;
  scope: EventEditScope;
  occurrence_date: string | null;
}

interface EventFormModalProps {
  open: boolean;
  editingEvent: CalendarEventRow | null;
  categories: CategoryMeta[];
  initialDate: string;
  initialStartTime?: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: EventFormPayload) => Promise<void>;
  canUploadCover?: boolean;
}

export function EventFormModal({
  open,
  editingEvent,
  categories,
  initialDate,
  initialStartTime,
  busy,
  onClose,
  onSubmit,
  canUploadCover = true,
}: EventFormModalProps) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(initialDate);
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("general");
  const [audience, setAudience] = useState<"all" | "members" | "staff">("all");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reminders, setReminders] = useState<number[]>([]);
  const [recFreq, setRecFreq] = useState<"" | RecurrenceFreq>("");
  const [recInterval, setRecInterval] = useState(1);
  const [recWeekdays, setRecWeekdays] = useState<number[]>([]);
  const [recUntil, setRecUntil] = useState("");
  const [recCount, setRecCount] = useState("");
  const [scope, setScope] = useState<EventEditScope>("all");

  const [formError, setFormError] = useState<string | null>(null);
  const dialogRef = useModalTrap(open, onClose, busy || uploadingCover);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setCoverError(null);
    if (editingEvent) {
      setTitle(editingEvent.title || "");
      setEventDate((editingEvent.event_date || initialDate).slice(0, 10));
      setEndDate(editingEvent.end_date ? editingEvent.end_date.slice(0, 10) : "");
      setCategory((editingEvent.category || "general").toLowerCase());
      setAudience(
        editingEvent.audience === "members" || editingEvent.audience === "staff"
          ? editingEvent.audience
          : "all"
      );
      setAllDay(isAllDayEvent(editingEvent));
      setStartTime(normalizeHHMM(editingEvent.start_time) || "08:00");
      setEndTime(normalizeHHMM(editingEvent.end_time) || "17:00");
      setLocation(editingEvent.location || "");
      setDescription(editingEvent.description || "");
      setCoverImage(editingEvent.cover_image ?? editingEvent.image ?? null);
      setReminders(Array.isArray(editingEvent.reminders) ? editingEvent.reminders : []);
      setRecFreq(editingEvent.recurrence_freq ?? "");
      setRecInterval(editingEvent.recurrence_interval ?? 1);
      setRecWeekdays(
        Array.isArray(editingEvent.recurrence_weekdays) ? editingEvent.recurrence_weekdays : []
      );
      setRecUntil(editingEvent.recurrence_until ? editingEvent.recurrence_until.slice(0, 10) : "");
      setRecCount(editingEvent.recurrence_count ? String(editingEvent.recurrence_count) : "");
      setScope(editingEvent.is_recurring ? "this" : "all");
    } else {
      setTitle("");
      setEventDate(initialDate);
      setEndDate("");
      setCategory("general");
      setAudience("all");
      setAllDay(false);
      setStartTime(initialStartTime || "08:00");
      setEndTime("17:00");
      setLocation("");
      setDescription("");
      setCoverImage(null);
      setReminders([]);
      setRecFreq("");
      setRecInterval(1);
      setRecWeekdays([]);
      setRecUntil("");
      setRecCount("");
      setScope("all");
    }
  }, [open, editingEvent, initialDate, initialStartTime]);

  if (!open) return null;

  const isEdit = Boolean(editingEvent);
  const catMeta = getCategoryMeta(category, categories);

  const handleCoverFile = async (file: File | null) => {
    if (!file) return;
    setCoverError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setCoverError("Use JPEG, PNG, or WebP images only.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setCoverError("Event cover image must be 2 MB or smaller.");
      return;
    }
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("folder", "event-banners");
      fd.append("file", file);
      const res = await fetch("/api/storage/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !json.ok || !json.url) {
        throw new Error(json.error || "Cover upload failed.");
      }
      setCoverImage(json.url);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "Cover upload failed.");
    } finally {
      setUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleReminder = (mins: number) => {
    setReminders((prev) =>
      prev.includes(mins) ? prev.filter((m) => m !== mins) : [...prev, mins].sort((a, b) => a - b)
    );
  };

  const toggleWeekday = (dow: number) => {
    setRecWeekdays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort((a, b) => a - b)
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Please enter an event title.");
      return;
    }
    if (!eventDate) {
      setFormError("Please choose an event date.");
      return;
    }
    if (endDate && endDate < eventDate) {
      setFormError("End date cannot be earlier than start date.");
      return;
    }
    const sameDay = !endDate || endDate === eventDate;
    if (!allDay && sameDay && startTime && endTime && endTime < startTime) {
      setFormError("End time cannot be earlier than start time.");
      return;
    }

    const parsedCount = recCount.trim() ? Number(recCount) : null;
    if (
      parsedCount !== null &&
      (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 366)
    ) {
      setFormError("Recurrence count must be between 1 and 366.");
      return;
    }

    await onSubmit({
      id: editingEvent ? (editingEvent.master_id ?? editingEvent.id) : null,
      title: trimmedTitle,
      event_date: eventDate,
      end_date: endDate || null,
      category,
      start_time: allDay ? "" : startTime,
      end_time: allDay ? "" : endTime,
      all_day: allDay,
      audience,
      location: location.trim(),
      description: description.trim(),
      cover_image: coverImage,
      reminders,
      recurrence: recFreq
        ? {
            freq: recFreq,
            interval: Math.min(12, Math.max(1, Number(recInterval) || 1)),
            weekdays: recFreq === "weekly" && recWeekdays.length > 0 ? recWeekdays : null,
            day_of_month: recFreq === "monthly" ? Number(eventDate.slice(8, 10)) || null : null,
            until: recUntil || null,
            count: parsedCount,
          }
        : null,
      scope: editingEvent?.is_recurring ? scope : "all",
      occurrence_date: editingEvent?.occurrence_date ?? editingEvent?.event_date ?? null,
    });
  };

  return (
    <div
      className="cal-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy && !uploadingCover) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="cal-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-form-title"
        tabIndex={-1}
      >
        <div className="cal-modal-header">
          <h2 id="cal-form-title" className="cal-modal-title">
            <span className="cal-modal-icon-badge">
              {isEdit ? (
                <Pencil className="h-4 w-4" aria-hidden="true" />
              ) : (
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <span>{isEdit ? "Edit Event" : "Add New Event"}</span>
          </h2>
          <button
            type="button"
            className="cal-modal-close"
            onClick={onClose}
            disabled={busy || uploadingCover}
            aria-label="Close event form"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
          <div className="cal-modal-body">
            <div className="cal-date-banner">
              <div className="cal-date-chip">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{formatLongDate(eventDate)}</span>
              </div>
              <span className="cal-tz-pill">Asia/Manila · UTC+8</span>
            </div>

            {editingEvent?.is_recurring && (
              <div className="cal-subpanel">
                <div className="cal-fg" style={{ marginBottom: 0 }}>
                  <label htmlFor="evEditScope" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Repeat className="h-3.5 w-3.5" aria-hidden="true" /> Apply changes to
                  </label>
                  <select
                    id="evEditScope"
                    value={scope}
                    onChange={(e) => setScope(e.target.value as EventEditScope)}
                    disabled={busy}
                  >
                    <option value="this">This event only ({editingEvent.occurrence_date})</option>
                    <option value="following">This and following events</option>
                    <option value="all">All events in series</option>
                  </select>
                </div>
              </div>
            )}

            {formError && (
              <div
                role="alert"
                style={{
                  marginBottom: 14,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(255, 99, 99, 0.4)",
                  background: "rgba(255, 99, 99, 0.12)",
                  color: "#ff8585",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                }}
              >
                {formError}
              </div>
            )}

            <div className="cal-two-col">
              {/* Left Column: Core schedule & classification */}
              <div>
                <div className="cal-fg">
                  <label htmlFor="evTitle">
                    Event Title <span style={{ color: "#ff6363" }}>*</span>
                  </label>
                  <div className="cal-input-wrap">
                    <Type className="cal-input-icon h-4 w-4" aria-hidden="true" />
                    <input
                      id="evTitle"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Reading Week Kickoff"
                      maxLength={255}
                      disabled={busy}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="cal-fg">
                    <label htmlFor="evDate">Start Date</label>
                    <input
                      id="evDate"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      disabled={busy}
                      required
                    />
                  </div>
                  <div className="cal-fg">
                    <label htmlFor="evEndDate">End Date</label>
                    <input
                      id="evEndDate"
                      type="date"
                      value={endDate}
                      min={eventDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                </div>

                <label className="cal-switch-row" htmlFor="evAllDay">
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <Clock className="h-4 w-4 opacity-70" aria-hidden="true" />
                    All-day event
                  </span>
                  <input
                    id="evAllDay"
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    disabled={busy}
                    style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                  />
                  <span className={`cal-switch-pill ${allDay ? "on" : ""}`} aria-hidden="true">
                    <span className="cal-switch-knob" />
                  </span>
                </label>

                {!allDay && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="cal-fg">
                      <label htmlFor="evStart">Start Time</label>
                      <input
                        id="evStart"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="cal-fg">
                      <label htmlFor="evEnd">End Time</label>
                      <input
                        id="evEnd"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="cal-fg">
                    <label htmlFor="evCategory">Category</label>
                    <div className="cal-cat-wrap">
                      <span
                        className="cal-cat-dot"
                        style={{ background: catMeta.color }}
                        aria-hidden="true"
                      />
                      <select
                        id="evCategory"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        disabled={busy}
                      >
                        {categories.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="cal-fg">
                    <label htmlFor="evAudience">Audience</label>
                    <select
                      id="evAudience"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value as "all" | "members" | "staff")}
                      disabled={busy}
                    >
                      <option value="all">Public &amp; All</option>
                      <option value="members">Members</option>
                      <option value="staff">Staff Only</option>
                    </select>
                  </div>
                </div>

                <div className="cal-fg" style={{ marginBottom: 0 }}>
                  <label htmlFor="evLocation">Location</label>
                  <div className="cal-input-wrap">
                    <MapPin className="cal-input-icon h-4 w-4" aria-hidden="true" />
                    <input
                      id="evLocation"
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Main Hall, Room 2"
                      maxLength={255}
                      disabled={busy}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Description, Cover, Reminders, Repeat */}
              <div>
                <div className="cal-fg">
                  <label htmlFor="evDesc">Description</label>
                  <textarea
                    id="evDesc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the event..."
                    disabled={busy}
                  />
                </div>

                {canUploadCover && (
                <div className="cal-fg">
                  <label>Cover Image (optional · max 2 MB)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => handleCoverFile(e.target.files?.[0] ?? null)}
                  />
                  {coverImage ? (
                    <div style={{ position: "relative" }}>
                      <img
                        src={coverImage}
                        alt="Event cover preview"
                        style={{
                          width: "100%",
                          height: 122,
                          objectFit: "cover",
                          borderRadius: 12,
                          border: "1px solid rgba(159, 193, 225, 0.22)",
                          display: "block",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setCoverImage(null)}
                        aria-label="Remove cover image"
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          border: "none",
                          background: "rgba(220, 38, 38, 0.92)",
                          color: "#ffffff",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="cal-dropzone"
                      disabled={busy || uploadingCover}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        void handleCoverFile(e.dataTransfer.files?.[0] ?? null);
                      }}
                    >
                      {uploadingCover ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                          <span>Uploading image…</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 opacity-75" aria-hidden="true" />
                          <span>
                            <strong style={{ color: "var(--cal-accent, #9fc1e1)" }}>
                              Click to upload
                            </strong>{" "}
                            or drag &amp; drop
                          </span>
                          <span style={{ fontSize: "0.69rem", opacity: 0.65 }}>
                            JPEG · PNG · WEBP
                          </span>
                        </>
                      )}
                    </button>
                  )}
                  {coverError && (
                    <div style={{ color: "#ff8585", fontSize: "0.74rem", marginTop: 5 }}>
                      {coverError}
                    </div>
                  )}
                </div>
                )}

                <div className="cal-subpanel">
                  <div className="cal-fg" style={{ marginBottom: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Bell className="h-3.5 w-3.5" aria-hidden="true" /> Reminders
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {REMINDER_OPTIONS.map((opt) => {
                        const on = reminders.includes(opt.minutes);
                        return (
                          <button
                            key={opt.minutes}
                            type="button"
                            onClick={() => toggleReminder(opt.minutes)}
                            aria-pressed={on}
                            style={{
                              minHeight: 30,
                              padding: "4px 10px",
                              borderRadius: 8,
                              border: `1px solid ${on ? "#48c78e" : "rgba(159, 193, 225, 0.2)"}`,
                              background: on ? "rgba(72, 199, 142, 0.2)" : "transparent",
                              color: on ? "#48c78e" : "inherit",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {opt.label.replace(" before", "")}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="cal-fg" style={{ marginBottom: 0 }}>
                    <label htmlFor="evRepeat" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Repeat className="h-3.5 w-3.5" aria-hidden="true" /> Repeat
                    </label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: recFreq ? "2fr 1fr" : "1fr",
                        gap: 8,
                      }}
                    >
                      <select
                        id="evRepeat"
                        value={recFreq}
                        onChange={(e) => setRecFreq(e.target.value as "" | RecurrenceFreq)}
                        disabled={busy}
                      >
                        <option value="">Does not repeat</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                      {recFreq && (
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={recInterval}
                          onChange={(e) => setRecInterval(Number(e.target.value) || 1)}
                          aria-label="Repeat interval"
                          title="Every N periods (1–12)"
                          disabled={busy}
                        />
                      )}
                    </div>

                    {recFreq === "weekly" && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                        {WEEKDAY_LABELS.map((lbl, idx) => {
                          const on = recWeekdays.includes(idx);
                          return (
                            <button
                              key={lbl}
                              type="button"
                              onClick={() => toggleWeekday(idx)}
                              aria-pressed={on}
                              style={{
                                minWidth: 34,
                                minHeight: 28,
                                borderRadius: 7,
                                border: `1px solid ${on ? "#9fc1e1" : "rgba(159, 193, 225, 0.2)"}`,
                                background: on ? "rgba(159, 193, 225, 0.22)" : "transparent",
                                color: on ? "#9fc1e1" : "inherit",
                                fontSize: "0.69rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {recFreq && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        <input
                          type="date"
                          value={recUntil}
                          min={eventDate}
                          onChange={(e) => setRecUntil(e.target.value)}
                          aria-label="Repeat until date"
                          title="Repeat until (optional)"
                          disabled={busy}
                        />
                        <input
                          type="number"
                          min={1}
                          max={366}
                          value={recCount}
                          onChange={(e) => setRecCount(e.target.value)}
                          placeholder="Max count"
                          aria-label="Maximum occurrences"
                          disabled={busy}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="cal-modal-footer">
            <button
              type="button"
              className="cal-mbtn cal-mbtn-cancel"
              onClick={onClose}
              disabled={busy || uploadingCover}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cal-mbtn cal-mbtn-save"
              disabled={busy || uploadingCover}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {isEdit ? "Updating…" : "Saving…"}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {isEdit ? "Update Event" : "Save Event"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EventDetailModalProps {
  event: CalendarEventRow | null;
  categories: CategoryMeta[];
  onClose: () => void;
  onEdit: (ev: CalendarEventRow) => void;
  onDelete: (ev: CalendarEventRow) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function EventDetailModal({
  event,
  categories,
  onClose,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: EventDetailModalProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const dialogRef = useModalTrap(Boolean(event), onClose, false);

  useEffect(() => {
    setImgFailed(false);
  }, [event?.id, event?.occurrence_date]);

  if (!event) return null;

  const cat = getCategoryMeta(event.category, categories);
  const coverUrl = event.cover_image ?? event.image ?? null;
  const timeText = isAllDayEvent(event)
    ? "All day"
    : `${formatTime12h(event.start_time)}${event.end_time ? ` – ${formatTime12h(event.end_time)}` : ""} PHT`;
  const audienceLabel =
    event.audience === "staff"
      ? "Staff Only"
      : event.audience === "members"
        ? "Members"
        : "Public & All";

  return (
    <div
      className="cal-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="cal-modal-dialog cal-modal-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-detail-title"
        tabIndex={-1}
      >
        <div className="cal-modal-header">
          <h2 id="cal-detail-title" className="cal-modal-title">
            <span className="cal-modal-icon-badge" style={{ background: cat.bg, borderColor: cat.border, color: cat.color }}>
              <Calendar className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>Event Details</span>
          </h2>
          <button
            type="button"
            className="cal-modal-close"
            onClick={onClose}
            aria-label="Close event details"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="cal-modal-body">
          <div className="cal-detail-grid">
            {/* Left column: Cover + structured schedule metadata */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {coverUrl && !imgFailed ? (
                <img
                  src={coverUrl}
                  alt={event.title}
                  onError={() => setImgFailed(true)}
                  className="cal-detail-cover"
                />
              ) : (
                <div
                  className="cal-detail-placeholder"
                  style={{
                    background: `linear-gradient(145deg, ${cat.bg}, rgba(255,255,255,0.03))`,
                    borderColor: cat.border,
                    color: cat.color,
                  }}
                >
                  <ImageIcon className="h-9 w-9 opacity-65" aria-hidden="true" />
                  <span style={{ fontSize: "0.72rem", fontWeight: 600, opacity: 0.75 }}>
                    No cover image
                  </span>
                </div>
              )}

              <div className="cal-detail-meta-list">
                <div className="cal-detail-meta-row">
                  <Calendar className="h-4 w-4 shrink-0" style={{ color: cat.color, marginTop: 2 }} aria-hidden="true" />
                  <div>
                    <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.6, fontWeight: 700 }}>
                      Date
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {formatLongDate(event.event_date)}
                      {event.end_date && event.end_date !== event.event_date
                        ? ` – ${formatLongDate(event.end_date)}`
                        : ""}
                    </div>
                  </div>
                </div>

                <div className="cal-detail-meta-row">
                  <Clock className="h-4 w-4 shrink-0" style={{ color: "#9fc1e1", marginTop: 2 }} aria-hidden="true" />
                  <div>
                    <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.6, fontWeight: 700 }}>
                      Time
                    </div>
                    <div style={{ fontWeight: 600 }}>{timeText}</div>
                  </div>
                </div>

                {event.location && (
                  <div className="cal-detail-meta-row">
                    <MapPin className="h-4 w-4 shrink-0" style={{ color: "#48c78e", marginTop: 2 }} aria-hidden="true" />
                    <div>
                      <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.6, fontWeight: 700 }}>
                        Location
                      </div>
                      <div style={{ fontWeight: 600 }}>{event.location}</div>
                    </div>
                  </div>
                )}

                <div className="cal-detail-meta-row">
                  <Globe className="h-4 w-4 shrink-0" style={{ color: "#f7c94b", marginTop: 2 }} aria-hidden="true" />
                  <div>
                    <div style={{ fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.6, fontWeight: 700 }}>
                      Audience
                    </div>
                    <div style={{ fontWeight: 600 }}>{audienceLabel}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: Badges, Title, Description, Reminders */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    borderRadius: 8,
                    padding: "4px 11px",
                    fontSize: "0.73rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    background: cat.bg,
                    border: `1px solid ${cat.border}`,
                    color: cat.color,
                  }}
                >
                  <CategoryIcon category={cat.key} className="h-3.5 w-3.5" />
                  {cat.label}
                </span>

                {event.is_recurring && (
                  <span className="cal-detail-pill">
                    <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                    Repeats {event.recurrence_freq}
                  </span>
                )}

                {event.audience === "staff" && (
                  <span className="cal-detail-pill">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    Staff only
                  </span>
                )}
              </div>

              <h3 style={{ margin: 0, fontSize: "1.28rem", fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.02em" }}>
                {event.title}
              </h3>

              <div>
                <div
                  style={{
                    fontSize: "0.69rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.09em",
                    opacity: 0.55,
                    marginBottom: 6,
                  }}
                >
                  Description
                </div>
                <div className="cal-detail-desc-box">
                  {event.description || "No description provided."}
                </div>
              </div>

              {Array.isArray(event.reminders) && event.reminders.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "0.69rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.09em",
                      opacity: 0.55,
                      marginBottom: 6,
                    }}
                  >
                    Scheduled Reminders
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {event.reminders.map((m) => (
                      <span key={m} className="cal-detail-pill">
                        <Bell className="h-3 w-3" style={{ color: "#48c78e" }} aria-hidden="true" />
                        {REMINDER_OPTIONS.find((o) => o.minutes === m)?.label ?? `${m} min`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="cal-modal-footer between">
          {canDelete ? (
            <button
              type="button"
              className="cal-mbtn cal-mbtn-danger"
              onClick={() => {
                onClose();
                onDelete(event);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
            </button>
          ) : (
            <span />
          )}

          <div style={{ display: "flex", gap: 8 }}>
            {canEdit && (
              <button
                type="button"
                className="cal-mbtn cal-mbtn-edit"
                onClick={() => {
                  onClose();
                  onEdit(event);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" /> Edit Event
              </button>
            )}
            <button type="button" className="cal-mbtn cal-mbtn-cancel" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DeleteEventModalProps {
  event: CalendarEventRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (ev: CalendarEventRow, scope: EventEditScope) => Promise<void>;
}

export function DeleteEventModal({ event, busy, onClose, onConfirm }: DeleteEventModalProps) {
  const [scope, setScope] = useState<EventEditScope>("all");
  const dialogRef = useModalTrap(Boolean(event), onClose, busy);

  useEffect(() => {
    if (event) setScope(event.is_recurring ? "this" : "all");
  }, [event]);

  if (!event) return null;

  return (
    <div
      className="cal-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="cal-modal-dialog cal-modal-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-del-title"
        tabIndex={-1}
      >
        <div className="cal-modal-header">
          <h2 id="cal-del-title" className="cal-modal-title">
            <span className="cal-modal-icon-badge danger">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>Confirm Delete</span>
          </h2>
          <button
            type="button"
            className="cal-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close delete confirmation"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="cal-modal-body">
          <p style={{ margin: "0 0 12px", fontSize: "0.88rem", opacity: 0.82, lineHeight: 1.6 }}>
            Are you sure you want to delete <strong>&ldquo;{event.title}&rdquo;</strong>? This
            cannot be undone.
          </p>
          {event.is_recurring && (
            <div className="cal-fg" style={{ marginBottom: 0 }}>
              <label htmlFor="evDelScope">Delete Scope</label>
              <select
                id="evDelScope"
                value={scope}
                onChange={(e) => setScope(e.target.value as EventEditScope)}
                disabled={busy}
              >
                <option value="this">This event only ({event.occurrence_date})</option>
                <option value="following">This and following events</option>
                <option value="all">All events in series</option>
              </select>
            </div>
          )}
        </div>
        <div className="cal-modal-footer">
          <button type="button" className="cal-mbtn cal-mbtn-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="cal-mbtn cal-mbtn-danger"
            disabled={busy}
            onClick={() => onConfirm(event, scope)}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Yes, Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CategoryManagerModalProps {
  open: boolean;
  rows: EventCategoryRow[];
  busy: boolean;
  onClose: () => void;
  onCreate: (slug: string, name: string, color: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function CategoryManagerModal({
  open,
  rows,
  busy,
  onClose,
  onCreate,
  onDelete,
}: CategoryManagerModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#38bdf8");
  const dialogRef = useModalTrap(open, onClose, busy);

  if (!open) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);
    if (slug.length < 2) return;
    await onCreate(slug, cleanName, color);
    setName("");
  };

  return (
    <div
      className="cal-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="cal-modal-dialog cal-modal-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-cat-title"
        tabIndex={-1}
      >
        <div className="cal-modal-header">
          <h2 id="cal-cat-title" className="cal-modal-title">
            <span className="cal-modal-icon-badge accent">
              <Tags className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>Manage Categories</span>
          </h2>
          <button
            type="button"
            className="cal-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close category manager"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="cal-modal-body">
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Category color"
              style={{
                width: 44,
                height: 42,
                padding: 3,
                borderRadius: 10,
                border: "1px solid rgba(159, 193, 225, 0.22)",
                background: "transparent",
                cursor: "pointer",
              }}
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New category name…"
              maxLength={80}
              disabled={busy}
              style={{
                flex: 1,
                minHeight: 42,
                padding: "0 12px",
                borderRadius: 10,
                border: "1px solid rgba(159, 193, 225, 0.2)",
                background: "rgba(255, 255, 255, 0.06)",
                color: "inherit",
                fontSize: "0.85rem",
              }}
            />
            <button
              type="submit"
              className="cal-mbtn cal-mbtn-save"
              style={{ padding: "0 14px" }}
              disabled={busy || !name.trim()}
              aria-label="Add category"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => (
              <div
                key={r.id}
                className="cal-detail-meta-row"
                style={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: r.color }} />
                  <span style={{ fontSize: "0.84rem", fontWeight: 600 }}>{r.name}</span>
                  {r.is_system && (
                    <span style={{ fontSize: "0.68rem", opacity: 0.55 }}>(built-in)</span>
                  )}
                </div>
                {!r.is_system && (
                  <button
                    type="button"
                    className="cal-mbtn cal-mbtn-danger"
                    style={{ minHeight: 32, padding: "0 9px" }}
                    disabled={busy}
                    onClick={() => onDelete(r.id)}
                    aria-label={`Delete category ${r.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
