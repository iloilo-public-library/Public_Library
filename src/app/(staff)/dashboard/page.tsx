"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Archive,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Circle,
  Gauge,
  Lock,
  Menu,
  Shield,
  UserCog,
  Users,
} from "lucide-react";
import { StaffSidebar } from "@/components/layout/StaffSidebar";
import { AdminFooter } from "@/components/layout/AdminFooter";
import { swrPrivateConfig } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types/library";
import { UsersRoleChartCard } from "@/components/dashboard/UsersRoleChartCard";
import { OnlineStatusChartCard } from "@/components/dashboard/OnlineStatusChartCard";
import { BooksAddedChartCard } from "@/components/dashboard/BooksAddedChartCard";
import { CollectionConditionCard } from "@/components/dashboard/CollectionConditionCard";
import { AlertsPanelCard } from "@/components/dashboard/AlertsPanelCard";
import { BookAvailabilityTableCard } from "@/components/dashboard/BookAvailabilityTableCard";
import {
  useCountUp,
  type DashboardAlertItem,
  type InventoryApiResponse,
} from "@/components/dashboard/types";
import "@/components/dashboard/dashboard.css";

interface KpiCardProps {
  label: string;
  value: number | null | undefined;
  icon: typeof BookOpen;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
  danger?: boolean;
  isLoading: boolean;
  delayMs: number;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
  danger,
  isLoading,
  delayMs,
}: KpiCardProps) {
  const animated = useCountUp(value);

  return (
    <div
      className="dash-fade-up relative flex items-center gap-[11px] overflow-hidden rounded-[14px] px-[13px] py-[15px] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(0,0,0,0.2)]"
      style={{
        animationDelay: `${delayMs}ms`,
        backgroundColor: danger ? "rgba(255, 99, 99, 0.06)" : "var(--dash-card-bg)",
        border: danger
          ? "1px solid rgba(255, 99, 99, 0.24)"
          : "1px solid var(--dash-border)",
      }}
    >
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div
          className="truncate text-[0.65rem] uppercase tracking-[0.05em]"
          style={{ color: "var(--dash-text-muted)" }}
        >
          {label}
        </div>
        {isLoading ? (
          <div
            className="mt-1 h-5 w-12 animate-pulse rounded"
            style={{ backgroundColor: "var(--dash-track-bg)" }}
          />
        ) : (
          <div
            className="dash-tabular text-[1.4rem] font-bold leading-[1.1]"
            style={{ color: valueColor || "var(--dash-text-primary)" }}
          >
            {animated !== null ? animated.toLocaleString() : "—"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const {
    data: stats,
    error: statsError,
    isLoading: statsLoading,
    mutate: mutateStats,
  } = useSWR<DashboardStats>("/api/dashboard/stats", swrPrivateConfig);

  const {
    data: invData,
    error: invError,
    isLoading: invLoading,
    mutate: mutateInv,
  } = useSWR<InventoryApiResponse>(
    "/api/admin/data?resource=inventory",
    swrPrivateConfig
  );

  useEffect(() => {
    if (stats || invData) {
      setLastUpdated(
        new Date().toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }
  }, [stats, invData]);

  const handleRefreshAll = useCallback(() => {
    void mutateStats();
    void mutateInv();
  }, [mutateStats, mutateInv]);

  const inventoryRows = invData?.rows ?? [];

  // Aggregate inventory totals from inventory rows (fallback to stats if inventory fails)
  const invTotals = useMemo(() => {
    if (inventoryRows.length > 0) {
      return inventoryRows.reduce(
        (acc, r) => ({
          available: acc.available + (r.available_copies || 0),
          damaged: acc.damaged + (r.damaged_copies || 0),
          lost: acc.lost + (r.lost_copies || 0),
          total: acc.total + (r.volumes || 0),
        }),
        { available: 0, damaged: 0, lost: 0, total: 0 }
      );
    }
    return {
      available: stats?.available_books ?? 0,
      damaged: stats?.damaged_books ?? 0,
      lost: stats?.lost_books ?? 0,
      total: stats?.total_volumes ?? 0,
    };
  }, [inventoryRows, stats]);

  const totalAllUsers = stats
    ? (stats.roles?.admin ?? stats.total_admins ?? 0) +
      (stats.roles?.librarian ?? stats.total_librarians ?? 0) +
      (stats.roles?.user ?? stats.total_users ?? 0)
    : null;

  // Build Alerts & Attention list matching legacy dashboard.html verbatim
  const alerts = useMemo<DashboardAlertItem[]>(() => {
    const list: DashboardAlertItem[] = [];

    if (stats) {
      const locked = stats.locked_users ?? 0;
      if (locked > 0) {
        list.push({
          id: "locked-users",
          severity: "danger",
          icon: "lock",
          title: `${locked} account${locked > 1 ? "s" : ""} locked`,
          body: "Users are locked out due to failed login attempts. Review in User Management.",
          href: "/admin/users",
        });
      }

      const active = stats.status?.active ?? stats.online_users ?? 0;
      const offline = stats.status?.offline ?? stats.offline_users ?? 0;
      const offlinePct =
        active + offline > 0 ? Math.round((offline / (active + offline)) * 100) : 0;
      if (offlinePct > 80 && (totalAllUsers ?? 0) > 0) {
        list.push({
          id: "offline-users",
          severity: "warn",
          icon: "wifi-off",
          title: `${offlinePct}% of users currently offline`,
          body: "Most users are inactive. This is normal outside library hours.",
        });
      }

      if ((stats.roles?.admin ?? stats.total_admins ?? 0) === 0) {
        list.push({
          id: "no-admins",
          severity: "warn",
          icon: "shield",
          title: "No admin accounts found",
          body: "Create at least one admin account to manage the system.",
          href: "/admin/admins",
        });
      }
    }

    if (inventoryRows.length > 0) {
      const lowStock = inventoryRows.filter(
        (b) => (b.available_copies || 0) === 0 && (b.volumes || 0) > 0
      );
      const damaged = inventoryRows.filter((b) => (b.damaged_copies || 0) > 0);
      const lost = inventoryRows.filter((b) => (b.lost_copies || 0) > 0);

      if (lowStock.length > 0) {
        list.push({
          id: "out-of-stock",
          severity: "danger",
          icon: "out-of-stock",
          title: `${lowStock.length} book title${lowStock.length > 1 ? "s" : ""} out of stock`,
          body: `No available copies: ${lowStock
            .slice(0, 3)
            .map((b) => b.book_title)
            .join(", ")}${lowStock.length > 3 ? " and more…" : ""}`,
          href: "/admin/books",
        });
      }

      if (damaged.length > 0) {
        list.push({
          id: "damaged-copies",
          severity: "warn",
          icon: "damaged",
          title: `${damaged.length} title${damaged.length > 1 ? "s" : ""} have damaged copies`,
          body: `${invTotals.damaged} damaged cop${
            invTotals.damaged > 1 ? "ies" : "y"
          } need attention or replacement.`,
          href: "/admin/books",
        });
      }

      if (lost.length > 0) {
        list.push({
          id: "lost-copies",
          severity: "warn",
          icon: "lost",
          title: `${invTotals.lost} cop${invTotals.lost > 1 ? "ies" : "y"} marked as lost`,
          body: `Across ${lost.length} title${
            lost.length > 1 ? "s" : ""
          }. Consider reporting to management.`,
          href: "/admin/books",
        });
      }
    }

    return list;
  }, [stats, totalAllUsers, inventoryRows, invTotals]);

  const partialAlertWarning =
    statsError && !invError
      ? "User status alerts unavailable (stats request failed)."
      : invError && !statsError
      ? "Inventory alerts unavailable (inventory request failed)."
      : null;

  return (
    <div className="min-h-screen">
      <StaffSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        role="admin"
      />
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        aria-expanded={mobileOpen}
        className="fixed left-3 top-3 z-[1050] flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/12 bg-topbar/90 text-white/85 shadow-lg backdrop-blur-md transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden cursor-pointer"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <main
        className={cn(
          "px-4 pb-16 pt-16 transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:px-8 lg:pt-8",
          collapsed ? "lg:pl-[88px]" : "lg:pl-[264px]"
        )}
      >
        <div className="admin-dashboard-page mx-auto max-w-[1440px] overflow-x-clip">
          {/* Header */}
          <div className="mb-[22px]">
            <h1
              className="flex items-center gap-2 text-[1.65rem] font-bold tracking-[-0.03em]"
              style={{ color: "var(--dash-text-primary)" }}
            >
              <Gauge
                className="h-6 w-6 shrink-0"
                style={{ color: "var(--accent)" }}
                aria-hidden="true"
              />
              <span>
                Library <span style={{ color: "var(--accent)" }}>Dashboard</span>
              </span>
            </h1>
            <p className="mt-1 text-[0.84rem]" style={{ color: "var(--tl)" }}>
              Real-time overview of library activity and resources
            </p>
          </div>

          {/* 7 STAT CARDS */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            <KpiCard
              label="Total Books"
              value={stats ? stats.total_books : null}
              icon={BookOpen}
              iconBg="rgba(91, 155, 213, 0.18)"
              iconColor="var(--c-blue)"
              isLoading={statsLoading}
              delayMs={40}
            />
            <KpiCard
              label="Total Users"
              value={totalAllUsers}
              icon={Users}
              iconBg="rgba(91, 155, 213, 0.18)"
              iconColor="var(--c-blue)"
              isLoading={statsLoading}
              delayMs={80}
            />
            <KpiCard
              label="Active Now"
              value={stats ? stats.status?.active ?? stats.online_users : null}
              icon={Circle}
              iconBg="rgba(62, 207, 142, 0.18)"
              iconColor="var(--c-green)"
              valueColor="var(--c-green)"
              isLoading={statsLoading}
              delayMs={120}
            />
            <KpiCard
              label="Admins"
              value={stats ? stats.roles?.admin ?? stats.total_admins : null}
              icon={Shield}
              iconBg="rgba(155, 120, 232, 0.18)"
              iconColor="var(--c-purple)"
              isLoading={statsLoading}
              delayMs={160}
            />
            <KpiCard
              label="Librarians"
              value={stats ? stats.roles?.librarian ?? stats.total_librarians : null}
              icon={UserCog}
              iconBg="rgba(245, 166, 35, 0.18)"
              iconColor="var(--c-orange)"
              isLoading={statsLoading}
              delayMs={200}
            />
            <KpiCard
              label="Locked"
              value={stats ? stats.locked_users : null}
              icon={Lock}
              iconBg="rgba(224, 84, 84, 0.18)"
              iconColor="var(--c-red)"
              valueColor="var(--c-red)"
              danger
              isLoading={statsLoading}
              delayMs={240}
            />
            <KpiCard
              label="Available"
              value={
                !invLoading || stats
                  ? invTotals.available
                  : null
              }
              icon={CheckCircle2}
              iconBg="rgba(45, 212, 191, 0.18)"
              iconColor="var(--c-teal)"
              valueColor="var(--c-teal)"
              isLoading={invLoading && statsLoading}
              delayMs={280}
            />
          </div>

          {/* USER ANALYTICS */}
          <div className="dash-section-label">
            <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>User Analytics</span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <UsersRoleChartCard
              roles={stats?.roles}
              isLoading={statsLoading}
              hasError={Boolean(statsError)}
              onRetry={() => void mutateStats()}
            />
            <OnlineStatusChartCard
              status={stats?.status}
              isLoading={statsLoading}
              hasError={Boolean(statsError)}
              onRetry={() => void mutateStats()}
            />
            <BooksAddedChartCard
              booksPerDay={stats?.books_per_day}
              isLoading={statsLoading}
              hasError={Boolean(statsError)}
              onRetry={() => void mutateStats()}
            />
          </div>

          {/* INVENTORY OVERVIEW */}
          <div className="dash-section-label">
            <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Inventory Overview</span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CollectionConditionCard
              totalCopies={invTotals.total}
              available={invTotals.available}
              damaged={invTotals.damaged}
              lost={invTotals.lost}
              isLoading={invLoading && statsLoading}
              hasError={Boolean(invError && statsError)}
              onRetry={handleRefreshAll}
            />

            <AlertsPanelCard
              alerts={alerts}
              isLoading={statsLoading && invLoading}
              partialWarning={partialAlertWarning}
            />

            <BookAvailabilityTableCard
              rows={inventoryRows}
              isLoading={invLoading}
              hasError={Boolean(invError)}
              onRetry={() => void mutateInv()}
            />
          </div>

          {lastUpdated && (
            <p
              className="mt-5 text-right text-[0.7rem]"
              style={{ color: "var(--dash-text-faint)" }}
            >
              Last updated: {lastUpdated}
            </p>
          )}
        </div>
      </main>
      <AdminFooter collapsed={collapsed} />
    </div>
  );
}
