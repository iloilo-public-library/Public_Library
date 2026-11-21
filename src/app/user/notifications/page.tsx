"use client";

import useSWR from "swr";
import { Bell, Check, CheckCheck, Pin, X } from "lucide-react";
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

  const rows = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleAction = async (action: "read" | "dismiss" | "read_all", announcementId?: number) => {
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

        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={() => handleAction("read_all")}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card-glass p-12 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-accent/55" />
          <p className="text-sm font-semibold text-white">You&apos;re all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
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
                  <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 font-mono text-[0.68rem] uppercase text-accent">
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
