"use client";

import useSWR from "swr";
import { ShieldCheck, User } from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { swrPrivateConfig } from "@/lib/api";

interface SessionResponse {
  authenticated: boolean;
  user: { id: number; role: string; email: string } | null;
}

export default function UserEditProfilePage() {
  const { data } = useSWR<SessionResponse>("/api/auth/session", swrPrivateConfig);

  return (
    <MemberShell>
      <div className="mb-6">
        <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
          Member <span className="text-accent">Profile &amp; Settings</span>
        </h1>
        <p className="mt-1 text-sm text-tl/80">
          Review your account session and customize your appearance theme.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-card-glass p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Account Details</h2>
              <p className="text-xs text-tl/70">Active Supabase session</p>
            </div>
          </div>

          <dl className="space-y-2.5 text-xs">
            <div className="flex justify-between border-b border-white/6 pb-2">
              <dt className="text-white/50">Email</dt>
              <dd className="font-mono text-white">{data?.user?.email || "Not signed in"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/50">Role</dt>
              <dd className="font-mono uppercase text-accent">{data?.user?.role || "—"}</dd>
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
                <h2 className="text-sm font-bold text-white">Display Theme</h2>
                <p className="text-xs text-tl/70">Toggle Light or Dark mode</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
          <p className="text-xs leading-relaxed text-tl/75">
            Theme preferences sync immediately across all catalog, event, and profile pages.
          </p>
        </div>
      </div>
    </MemberShell>
  );
}
