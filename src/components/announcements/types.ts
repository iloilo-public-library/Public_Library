export type AnnouncementCategory = "general" | "urgent" | "event" | "reminder";
export type CategoryFilter = "all" | AnnouncementCategory;

export interface AnnouncementRow {
  id: number;
  title: string;
  body: string;
  category: AnnouncementCategory | string;
  pinned: boolean;
  author: string;
  target_user_id: number | null;
  target_user_name?: string | null;
  created_at: string;
}

export interface MemberPickerOption {
  id: number;
  fullname: string;
  library_card_number: string | null;
}

export interface AnnouncementFormValues {
  title: string;
  body: string;
  category: AnnouncementCategory;
  pinned: boolean;
  target_user_id: number | null;
  target_user_name: string | null;
}

export const TAG_META: Record<
  AnnouncementCategory,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
  }
> = {
  general: {
    label: "General",
    color: "var(--accent)",
    bg: "rgba(var(--accent-rgb), 0.08)",
    border: "rgba(var(--accent-rgb), 0.35)",
  },
  urgent: {
    label: "Urgent",
    color: "var(--danger)",
    bg: "rgba(var(--danger-rgb), 0.08)",
    border: "rgba(var(--danger-rgb), 0.35)",
  },
  event: {
    label: "Event",
    color: "var(--accent2)",
    bg: "rgba(var(--accent2-rgb), 0.08)",
    border: "rgba(var(--accent2-rgb), 0.35)",
  },
  reminder: {
    label: "Reminder",
    color: "var(--warn)",
    bg: "rgba(var(--warn-rgb), 0.08)",
    border: "rgba(var(--warn-rgb), 0.35)",
  },
};

export function normalizeCategory(raw: string | undefined): AnnouncementCategory {
  if (raw === "urgent" || raw === "event" || raw === "reminder") return raw;
  return "general";
}

/**
 * Formats an ISO timestamp using the exact legacy relative wording
 * ("Just now", "Xm ago", "Xh ago", "Xd ago", or en-PH date).
 */
export function formatAnnouncementDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const s = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isAnnouncementToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const t = new Date();
  return (
    d.getDate() === t.getDate() &&
    d.getMonth() === t.getMonth() &&
    d.getFullYear() === t.getFullYear()
  );
}
