"use client";

import useSWR from "swr";
import { CalendarDays, MapPin } from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { swrPublicConfig } from "@/lib/api";

interface EventRow {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  location: string | null;
  category: string;
}

export default function UserEventsPage() {
  const { data, isLoading } = useSWR<{ rows?: EventRow[] }>(
    "/api/admin/data?resource=events",
    swrPublicConfig
  );
  const events = data?.rows ?? [];

  return (
    <MemberShell>
      <div className="mb-6">
        <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
          Library <span className="text-accent">Events &amp; Programs</span>
        </h1>
        <p className="mt-1 text-sm text-tl/80">
          Upcoming storytelling sessions, workshops, and community gatherings.
        </p>
      </div>

      {isLoading ? (
        <div className="h-36 animate-pulse rounded-2xl bg-white/5" />
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card-glass p-12 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-accent/55" />
          <h2 className="text-base font-bold text-white">No Upcoming Events Scheduled</h2>
          <p className="mt-1 text-xs text-tl/75">
            Check back soon for new library programs and literacy events.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="rounded-2xl border border-white/10 bg-card-glass p-5 backdrop-blur-sm"
            >
              <span className="inline-block rounded-full border border-accent/25 bg-accent/12 px-2.5 py-0.5 font-mono text-[0.68rem] font-bold uppercase text-accent">
                {ev.category}
              </span>
              <h3 className="mt-3 text-base font-bold text-white">{ev.title}</h3>
              {ev.description && (
                <p className="mt-1.5 text-xs leading-relaxed text-tl/80">{ev.description}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-3 border-t border-white/8 pt-3 font-mono text-[0.72rem] text-white/55">
                <span>{ev.event_date}</span>
                {ev.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {ev.location}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </MemberShell>
  );
}
