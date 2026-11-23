"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  Bell,
  Check,
  CheckCheck,
  Pin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { Button } from "@/components/ui/button";
import { apiMutate, swrPrivateConfig } from "@/lib/api";

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
          <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
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
        <div className="rounded-2xl border border-white/10 bg-card-glass p-12 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-accent/55" />
          <p className="text-sm font-semibold text-white">
            {rows.length === 0 ? "You're all caught up!" : "No notifications match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-5 backdrop-blur-sm transition ${
                item.is_read
                  ? "border-white/8 bg-card-glass/70 opacity-85"
                  : "border-accent/30 bg-card-glass shadow-[0_6px_24px_rgba(0,0,0,0.2)]"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!item.is_read && <span className="h-2 w-2 rounded-full bg-accent" />}
                  {item.pinned && <Pin className="h-3.5 w-3.5 text-gold" />}
                  <h2 className="text-sm font-bold text-white">{item.title}</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="whitespace-nowrap rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 font-mono text-[0.68rem] uppercase text-accent">
                    {item.category}
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
              <p className="whitespace-pre-line text-xs leading-relaxed text-tl/85">{item.body}</p>
              <div className="mt-3 font-mono text-[0.7rem] text-white/45">
                {item.author} · {new Date(item.created_at).toLocaleDateString()}
              </div>
            </article>
          ))}
        </div>
      )}
    </MemberShell>
  );
}
