"use client";

import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  BookCheck,
  BookOpen,
  CreditCard,
  Layers,
  Package,
  RefreshCw,
  RotateCcw,
  UserCheck,
  Users,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { Button } from "@/components/ui/button";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { swrPrivateConfig } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types/library";

export default function LibrarianDashboardPage() {
  const { data: stats, error, isLoading, mutate } = useSWR<DashboardStats>(
    "/api/dashboard/stats",
    swrPrivateConfig
  );

  const kpis = [
    {
      label: "Catalog Titles",
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
      label: "Borrowed Copies",
      value: stats?.borrowed_books ?? "—",
      icon: CreditCard,
      tone: "text-[#f5a623] bg-[#f5a623]/15 border-[#f5a623]/25",
    },
    {
      label: "Overdue Cards",
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

  const totalVol = Math.max(1, stats?.total_volumes ?? 0);
  const inventoryBreakdown = [
    {
      label: "Available",
      value: stats?.available_books ?? 0,
      color: "bg-accent2",
      text: "text-accent2",
    },
    {
      label: "Borrowed",
      value: stats?.borrowed_books ?? 0,
      color: "bg-accent",
      text: "text-accent",
    },
    {
      label: "Damaged",
      value: stats?.damaged_books ?? 0,
      color: "bg-warn",
      text: "text-warn",
    },
    {
      label: "Lost",
      value: stats?.lost_books ?? 0,
      color: "bg-danger",
      text: "text-danger",
    },
  ];

  const maxDayCount = Math.max(
    1,
    ...(stats?.books_per_day?.map((d) => d.count) ?? [1])
  );

  return (
    <StaffShell title="Librarian Dashboard" role="librarian">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-white">
            Librarian <span className="text-accent">Dashboard</span>
          </h1>
          <p className="mt-1 text-[0.84rem] text-tl">
            Real-time overview of catalog inventory, borrowing activity, and member circulation.
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
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-xs text-warn">
          <span>Unable to load live library statistics. Please sign in or refresh.</span>
          <Button variant="accent" size="sm" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map(({ label, value, icon: Icon, tone }, idx) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.04 }}
            whileHover={{ y: -3 }}
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

      {/* Analytics Row */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Inventory Breakdown */}
        <div className="rounded-2xl border border-white/10 bg-card-glass p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-bold text-white">Inventory Condition Breakdown</h2>
            </div>
            <span className="font-mono text-xs text-accent">
              Total Volumes: {(stats?.total_volumes ?? 0).toLocaleString()}
            </span>
          </div>

          <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-white/8">
            {inventoryBreakdown.map((item) => {
              const pct = Math.min(100, Math.round((item.value / totalVol) * 100));
              return pct > 0 ? (
                <div
                  key={item.label}
                  style={{ width: `${pct}%` }}
                  className={cn("h-full transition-all", item.color)}
                  title={`${item.label}: ${item.value}`}
                />
              ) : null;
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {inventoryBreakdown.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/8 bg-bg1/55 px-3 py-2.5"
              >
                <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-tl/65">
                  {item.label}
                </div>
                <div className={cn("mt-1 font-mono text-lg font-bold", item.text)}>
                  {item.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3 text-xs text-tl/75">
            <span className="inline-flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-accent" />
              Issued Library Cards:{" "}
              <strong className="font-mono text-white">
                {(stats?.active_cards ?? 0).toLocaleString()}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5 text-accent2" />
              Completed Returns:{" "}
              <strong className="font-mono text-white">
                {(stats?.total_returns ?? 0).toLocaleString()}
              </strong>
            </span>
          </div>
        </div>

        {/* 7-Day Catalog Activity */}
        <div className="rounded-2xl border border-white/10 bg-card-glass p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              Catalog Additions (Last 7 Days)
            </h2>
            <span className="font-mono text-xs text-tl/60">Live 7-day count</span>
          </div>
          <div className="grid h-36 grid-cols-7 items-end gap-2 pt-3">
            {(stats?.books_per_day ?? []).map((day) => {
              const pct = Math.max(8, Math.round((day.count / maxDayCount) * 100));
              return (
                <div
                  key={day.label}
                  className="flex h-full flex-col items-center justify-end gap-1.5"
                >
                  <span className="font-mono text-[0.68rem] text-accent">{day.count}</span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      style={{ height: `${pct}%` }}
                      className="w-full rounded-t-md bg-gradient-to-t from-accent/45 to-accent transition-all"
                    />
                  </div>
                  <span className="truncate font-mono text-[0.62rem] text-tl/65">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Librarian Tools */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-card-glass p-5">
        <h2 className="mb-3 text-sm font-bold text-white">Quick Librarian Tools</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/librarian/account-requests", label: "Review Renewal Requests", icon: UserCheck },
            { href: "/librarian/books", label: "Manage Books & ISBNs", icon: BookOpen },
            { href: "/librarian/inventory", label: "Update Physical Stock", icon: Package },
            { href: "/librarian/library-cards", label: "Issue Cards & Returns", icon: CreditCard },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-xl border border-white/8 bg-bg1/55 px-3.5 py-2.5 text-xs font-semibold text-tl transition hover:border-accent/40 hover:text-white"
            >
              <span className="inline-flex items-center gap-2">
                <Icon className="h-4 w-4 text-accent" />
                {label}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-white/40" />
            </Link>
          ))}
        </div>
      </div>
    </StaffShell>
  );
}
