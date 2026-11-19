"use client";

import useSWR from "swr";
import { Bell, Pin } from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { swrPublicConfig } from "@/lib/api";

interface AnnouncementRow {
  id: number;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  author: string;
  created_at: string;
}

export default function UserNotificationsPage() {
  const { data, isLoading } = useSWR<{ rows?: AnnouncementRow[] }>(
    "/api/admin/data?resource=announcements",
    swrPublicConfig
  );
  const rows = data?.rows ?? [];

  return (
    <MemberShell>
      <div className="mb-6">
        <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
          Notifications &amp; <span className="text-accent">Announcements</span>
        </h1>
        <p className="mt-1 text-sm text-tl/80">
          Official bulletins, maintenance notices, and due-date reminders.
        </p>
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
              className="rounded-2xl border border-white/10 bg-card-glass p-5 backdrop-blur-sm"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {item.pinned && <Pin className="h-3.5 w-3.5 text-gold" />}
                  <h2 className="text-sm font-bold text-white">{item.title}</h2>
                </div>
                <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 font-mono text-[0.68rem] uppercase text-accent">
                  {item.category}
                </span>
              </div>
              <p className="whitespace-pre-line text-xs leading-relaxed text-tl/85">{item.body}</p>
              <div className="mt-3 font-mono text-[0.7rem] text-white/45">
                {item.author} · {item.created_at}
              </div>
            </article>
          ))}
        </div>
      )}
    </MemberShell>
  );
}
