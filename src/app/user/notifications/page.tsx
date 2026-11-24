"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  Megaphone,
  Pin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { Button } from "@/components/ui/button";
import { apiMutate, swrPrivateConfig } from "@/lib/api";

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface NotificationRow {
  id: number;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  author: string;
  created_at: string;
  is_read: boolean;
}

export default function UserNotificationsPage() {
  const { data, isLoading, mutate } = useSWR<{
    ok?: boolean;
    notifications?: NotificationRow[];
    unreadCount?: number;
  }>("/api/user/notifications", swrPrivateConfig);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const rows = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((item) => {
      if (onlyUnread && item.is_read) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        (item.author || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, categoryFilter, onlyUnread]);

  const handleAction = async (
    action: "read" | "dismiss" | "read_all",
    announcementId?: number
  ) => {
    await apiMutate("/api/user/notifications", {
      method: "PUT",
      body: action === "read_all" ? { action } : { action, announcement_id: announcementId },
    });
    await mutate();
  };

  return (
    <MemberShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold uppercase">
            Member Inbox &middot; Iloilo City Public Library
          </div>
          <h1 className="font-serif text-[clamp(1.85rem,3vw,2.5rem)] font-bold leading-tight tracking-[-0.02em] text-white">
            Notifications &amp; <span className="text-accent">Announcements</span>
          </h1>
          <p className="mt-1 text-sm text-tl/80">
            Official bulletins, maintenance notices, and account updates
            {unreadCount > 0 ? ` (${unreadCount} unread)` : ""}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(query.trim() !== "" || categoryFilter !== "all" || onlyUnread) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategoryFilter("all");
                setOnlyUnread(false);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-tl transition hover:border-white/20 hover:text-white"
            >
              <X className="h-3.5 w-3.5" /> Reset
            </button>
          )}
          {unreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={() => handleAction("read_all")}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Unified Browse-Catalog Command Search & Category Filter Bar */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="group relative flex-1">
          <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-accent/20 via-accent2/10 to-accent/20 opacity-0 blur transition duration-300 group-focus-within:opacity-100" />
          <div className="relative flex h-[48px] items-center rounded-2xl border border-white/12 bg-bg1/90 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-200 focus-within:border-accent/50 focus-within:bg-bg1">
            <Search className="h-4.5 w-4.5 shrink-0 text-accent/80" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notifications by title, announcement text, or author..."
              className="w-full bg-transparent py-2 pl-3 pr-3 text-[0.9rem] text-white placeholder:text-white/38 focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/8 text-white/60 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden shrink-0 items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[0.68rem] text-white/45 sm:inline-flex">
                ⌘K
              </kbd>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["all", "general", "urgent", "event", "reminder"].map((cat) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`inline-flex h-[48px] cursor-pointer items-center rounded-2xl border px-4 text-xs font-semibold capitalize transition-all ${
                  active
                    ? "border-accent/45 bg-accent/15 text-accent shadow-[0_0_20px_rgba(147,197,253,0.14)]"
                    : "border-white/12 bg-bg1/85 text-white/80 hover:border-white/22 hover:bg-white/8 hover:text-white"
                }`}
              >
                {cat === "all" ? "All Categories" : cat}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setOnlyUnread((v) => !v)}
            aria-pressed={onlyUnread}
            className={`inline-flex h-[48px] cursor-pointer items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition-all ${
              onlyUnread
                ? "border-accent2/45 bg-accent2/15 text-accent2"
                : "border-white/12 bg-bg1/85 text-white/75 hover:border-white/22 hover:text-white"
            }`}
          >
            Unread Only ({unreadCount})
          </button>

          <div className="ml-auto flex h-[48px] items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 text-xs text-tl lg:ml-0">
            <SlidersHorizontal className="h-3.5 w-3.5 text-accent/70" />
            <span className="whitespace-nowrap">
              <strong className="font-semibold text-white">{filteredRows.length}</strong> /{" "}
              {rows.length}
            </span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-12 text-center backdrop-blur-md">
          <Bell className="mx-auto mb-3 h-10 w-10 text-accent/55" />
          <p className="text-sm font-semibold text-white">
            {rows.length === 0 ? "You're all caught up!" : "No notifications match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((item) => {
            const cat = (item.category || "general").toLowerCase();
            const isUrgent = cat === "urgent";
            const isEvent = cat === "event";
            const iconColor = isUrgent
              ? "text-danger"
              : isEvent
                ? "text-gold"
                : "text-warn";
            const catTextColor = isUrgent
              ? "text-danger"
              : isEvent
                ? "text-gold"
                : "text-accent";
            return (
              <article
                key={item.id}
                className={`rounded-2xl border bg-white/[0.03] p-4 backdrop-blur-md transition hover:border-white/20 ${
                  item.is_read
                    ? "border-white/8 opacity-85"
                    : "border-accent/30 shadow-[0_6px_24px_rgba(0,0,0,0.22)]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] ${iconColor}`}>
                      {isUrgent ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : isEvent ? (
                        <CalendarDays className="h-4 w-4" />
                      ) : (
                        <Megaphone className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {!item.is_read && <span className="h-2 w-2 rounded-full bg-accent" />}
                        {item.pinned && <Pin className="h-3.5 w-3.5 text-gold" />}
                        <h2 className="text-[0.92rem] font-bold text-white">{item.title}</h2>
                      </div>
                      <div className={`mt-0.5 text-[0.72rem] font-semibold tracking-[0.03em] ${catTextColor}`}>
                        <span className="uppercase">{item.category}</span>
                        <span className="font-normal text-tl/65">
                          {" "}by <strong className="text-white/90">{item.author || "Library Staff"}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[0.7rem] text-white/45">
                      {formatRelativeTime(item.created_at)}
                    </span>
                    {!item.is_read && (
                      <button
                        type="button"
                        onClick={() => handleAction("read", item.id)}
                        title="Mark as read"
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-tl/75 transition hover:border-accent2/40 hover:text-accent2"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAction("dismiss", item.id)}
                      title="Dismiss notice"
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-tl/75 transition hover:border-danger/40 hover:text-danger"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {item.body && (
                  <div className="mt-3 rounded-xl border border-white/8 bg-black/25 px-3.5 py-2.5 whitespace-pre-line text-xs leading-relaxed text-tl/85">
                    {item.body}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </MemberShell>
  );
}
