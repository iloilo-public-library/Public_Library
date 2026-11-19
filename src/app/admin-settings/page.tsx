"use client";

import useSWR from "swr";
import { ShieldCheck, User } from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { swrPrivateConfig } from "@/lib/api";

interface SessionResponse {
  authenticated: boolean;
  user: { id: number; role: string; email: string } | null;
}

export default function AdminSettingsPage() {
  const { data } = useSWR<SessionResponse>("/api/auth/session", swrPrivateConfig);

  return (
    <StaffShell title="Admin Settings">
      <div className="mb-6">
        <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-white">
          Admin <span className="text-accent">Settings</span>
        </h1>
        <p className="mt-1 text-[0.84rem] text-tl">
          Account summary, appearance preferences, and session security.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-card-glass p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Signed-In Account</h2>
              <p className="text-xs text-tl/70">Authenticated via Supabase + HttpOnly session</p>
            </div>
          </div>

          <dl className="space-y-2.5 text-xs">
            <div className="flex justify-between border-b border-white/6 pb-2">
              <dt className="text-white/50">Email</dt>
              <dd className="font-mono text-white">{data?.user?.email || "Not signed in"}</dd>
            </div>
            <div className="flex justify-between border-b border-white/6 pb-2">
              <dt className="text-white/50">Role</dt>
              <dd className="font-mono uppercase text-accent">{data?.user?.role || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/50">User ID</dt>
              <dd className="font-mono text-white">{data?.user?.id ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card-glass p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent2/15 text-accent2">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Appearance &amp; Theme</h2>
                <p className="text-xs text-tl/70">Switch between Dark and Light modes</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
          <p className="text-xs leading-relaxed text-tl/75">
            Your theme preference is saved automatically in your browser and persists across all
            public, member, and staff pages.
          </p>
        </div>
      </div>
    </StaffShell>
  );
}
