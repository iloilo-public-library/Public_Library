"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookCheck,
  BookOpen,
  CreditCard,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import { StaffSidebar } from "@/components/layout/StaffSidebar";
import { StaffTopbar } from "@/components/layout/StaffTopbar";
import { Button } from "@/components/ui/button";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { swrPrivateConfig } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types/library";

export default function AdminDashboardPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: stats, error, isLoading, mutate } = useSWR<DashboardStats>(
    "/api/dashboard/stats",
    swrPrivateConfig
  );

  const kpis = [
    {
      label: "Total Books",
      value: stats?.total_books ?? "—",
      icon: BookOpen,
      tone: "text-[#5b9bd5] bg-[#5b9bd5]/15 border-[#5b9bd5]/25",
    },
    {
      label: "Available Copies",
      value: stats?.available_books ?? "—",
      icon: BookCheck,
      tone: "text-[#3ecf8e] bg-[#3ecf8e]/15 border-[#3ecf8e]/25",
    },
    {
      label: "Borrowed Books",
      value: stats?.borrowed_books ?? "—",
      icon: CreditCard,
      tone: "text-[#f5a623] bg-[#f5a623]/15 border-[#f5a623]/25",
    },
    {
      label: "Overdue Returns",
      value: stats?.overdue_books ?? "—",
      icon: AlertTriangle,
      tone: "text-[#e05454] bg-[#e05454]/15 border-[#e05454]/25",
    },
    {
      label: "Registered Members",
      value: stats?.total_users ?? "—",
      icon: Users,
      tone: "text-[#9b78e8] bg-[#9b78e8]/15 border-[#9b78e8]/25",
    },
    {
      label: "Pending Requests",
      value: stats?.pending_requests ?? "—",
      icon: UserCheck,
      tone: "text-[#2dd4bf] bg-[#2dd4bf]/15 border-[#2dd4bf]/25",
    },
  ];

  return (
    <div className="min-h-screen">
      <StaffSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        role="admin"
      />
      <StaffTopbar
        title="Admin Dashboard"
        collapsed={collapsed}
        onOpenMobile={() => setMobileOpen(true)}
      />

      <main
        className={cn(
          "px-4 pb-16 pt-[76px] transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:px-8",
          collapsed ? "lg:pl-[88px]" : "lg:pl-[264px]"
        )}
      >
        <div className="mx-auto max-w-[1440px]">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-white">
                Library <span className="text-accent">Dashboard</span>
              </h1>
              <p className="mt-1 text-[0.84rem] text-tl">
                Real-time overview of catalog inventory, circulation, and member activity.
              </p>
            </div>

            <LibraryTooltip label="Revalidate dashboard metrics">
              <Button variant="secondary" size="sm" onClick={() => mutate()}>
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh Stats
              </Button>
            </LibraryTooltip>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-xs text-warn">
              Sign in as an Administrator on the Flask backend to load live metrics from{" "}
              <code className="font-mono">/dashboard/stats</code>.
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map(({ label, value, icon: Icon, tone }, idx) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
                whileHover={{ y: -4 }}
                className="rounded-2xl border border-white/8 bg-card-glass p-5 backdrop-blur-sm transition-colors hover:bg-card-glass-hover"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-tl/75">
                    {label}
                  </span>
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl border",
                      tone
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 font-mono text-[1.9rem] font-bold tracking-tight text-white">
                  {typeof value === "number" ? value.toLocaleString() : value}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
