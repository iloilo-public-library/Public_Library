"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Megaphone,
  Pencil,
  Pin,
  Trash2,
  UserCheck,
  UserCircle2,
} from "lucide-react";
import {
  formatAnnouncementDate,
  normalizeCategory,
  TAG_META,
  type AnnouncementCategory,
  type AnnouncementRow,
} from "./types";

interface AnnouncementCardProps {
  announcement: AnnouncementRow;
  delayMs: number;
  pinning: boolean;
  onTogglePin: (ann: AnnouncementRow) => void;
  onEdit: (ann: AnnouncementRow, triggerEl: HTMLButtonElement | null) => void;
  onDelete: (ann: AnnouncementRow, triggerEl: HTMLButtonElement | null) => void;
}

const CATEGORY_ICON: Record<AnnouncementCategory, typeof Megaphone> = {
  general: Megaphone,
  urgent: AlertTriangle,
  event: CalendarDays,
  reminder: Clock,
};

export function AnnouncementCard({
  announcement,
  delayMs,
  pinning,
  onTogglePin,
  onEdit,
  onDelete,
}: AnnouncementCardProps) {
  const [expanded, setExpanded] = useState(false);

  const cat = normalizeCategory(announcement.category);
  const meta = TAG_META[cat];
  const TagIcon = CATEGORY_ICON[cat];
  const isLong = announcement.body.length > 240;

  return (
    <article
      className={`ann-card ${announcement.pinned ? "is-pinned" : ""}`}
      style={
        {
          "--bar-color": meta.color,
          animationDelay: `${delayMs}ms`,
        } as React.CSSProperties
      }
    >
      {/* Category Tag + Pinned Badge */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[0.68rem] font-bold uppercase tracking-[0.04em]"
          style={{
            color: meta.color,
            backgroundColor: meta.bg,
            border: `1px solid ${meta.border}`,
          }}
        >
          <TagIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
          {meta.label}
        </span>

        {announcement.pinned && (
          <span
            className="inline-flex items-center gap-1 text-[0.67rem] font-bold"
            style={{ color: "var(--warn)" }}
          >
            <Pin className="h-3 w-3 shrink-0" aria-hidden="true" />
            Pinned
          </span>
        )}

        {announcement.target_user_id ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[0.66rem] font-semibold"
            style={{
              backgroundColor: "rgba(var(--accent-rgb), 0.1)",
              border: "1px solid rgba(var(--accent-rgb), 0.25)",
              color: "var(--accent)",
            }}
          >
            <UserCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
            Sent to {announcement.target_user_name || `Member #${announcement.target_user_id}`}
          </span>
        ) : (
          <span
            className="text-[0.66rem] font-medium"
            style={{ color: "var(--ann-text-faint)" }}
          >
            All members
          </span>
        )}
      </div>

      {/* Title */}
      <h3
        className="mb-[7px] text-[0.95rem] font-bold leading-[1.35]"
        style={{ color: "var(--ann-text-primary)" }}
      >
        {announcement.title}
      </h3>

      {/* Body */}
      <p
        className={`mb-3 whitespace-pre-wrap text-[0.83rem] leading-[1.65] ${
          expanded ? "" : "ann-body-clamp"
        }`}
        style={{ color: "var(--ann-text-secondary)" }}
      >
        {announcement.body}
      </p>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mb-2.5 inline-flex min-h-[36px] items-center bg-transparent p-0 text-[0.76rem] font-semibold hover:underline cursor-pointer"
          style={{ color: "var(--accent)" }}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      {/* Footer: Author + Relative Date + Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div
          className="flex flex-wrap items-center gap-1.5 text-[0.72rem]"
          style={{ color: "var(--ann-text-muted)" }}
        >
          <UserCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{announcement.author || "Admin"}</span>
          <span aria-hidden="true">·</span>
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{formatAnnouncementDate(announcement.created_at)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={pinning}
            title={announcement.pinned ? "Unpin" : "Pin"}
            aria-label={
              announcement.pinned
                ? `Unpin "${announcement.title}"`
                : `Pin "${announcement.title}"`
            }
            onClick={() => onTogglePin(announcement)}
            className="flex h-11 w-11 items-center justify-center rounded-[9px] transition cursor-pointer disabled:opacity-50"
            style={
              announcement.pinned
                ? {
                    backgroundColor: "rgba(var(--warn-rgb), 0.15)",
                    border: "1px solid rgba(var(--warn-rgb), 0.35)",
                    color: "var(--warn)",
                  }
                : {
                    backgroundColor: "var(--ann-pill-bg)",
                    border: "1px solid var(--ann-pill-border)",
                    color: "var(--ann-text-muted)",
                  }
            }
          >
            <Pin className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            title="Edit"
            aria-label={`Edit "${announcement.title}"`}
            onClick={(e) => onEdit(announcement, e.currentTarget)}
            className="flex h-11 w-11 items-center justify-center rounded-[9px] transition cursor-pointer hover:border-accent"
            style={{
              backgroundColor: "var(--ann-pill-bg)",
              border: "1px solid var(--ann-pill-border)",
              color: "var(--ann-text-muted)",
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            title="Delete"
            aria-label={`Delete "${announcement.title}"`}
            onClick={(e) => onDelete(announcement, e.currentTarget)}
            className="flex h-11 w-11 items-center justify-center rounded-[9px] transition cursor-pointer hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
            style={{
              backgroundColor: "var(--ann-pill-bg)",
              border: "1px solid var(--ann-pill-border)",
              color: "var(--ann-text-muted)",
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
