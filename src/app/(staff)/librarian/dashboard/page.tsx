"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Archive,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Gauge,
  HelpCircle,
  RefreshCw,
  Users,
  Wrench,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { swrPrivateConfig } from "@/lib/api";
import type { DashboardStats } from "@/types/library";
import { BooksAddedChartCard } from "@/components/dashboard/BooksAddedChartCard";
import { TopCategoriesCard } from "@/components/dashboard/TopCategoriesCard";
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
  isLoading: boolean;
  delayMs: number;
}

function LibrarianKpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
  isLoading,
  delayMs,
}: KpiCardProps) {
  const animated = useCountUp(value);

  return (
    <div
      className="dash-fade-up relative flex items-center gap-[11px] overflow-hidden rounded-[14px] px-[13px] py-[15px] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(0,0,0,0.2)]"
      style={{
        animationDelay: `${delayMs}ms`,
        backgroundColor: "var(--dash-card-bg)",
        border: "1px solid var(--dash-border)",
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

const LIBRARIAN_DASH_SWR = {
  ...swrPrivateConfig,
  refreshInterval: 60000,
};

export default function LibrarianDashboardPage() {
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const {
    data: stats,
    error: statsError,
    isLoading: statsLoading,
    isValidating: statsValidating,
    mutate: mutateStats,
  } = useSWR<DashboardStats>("/api/dashboard/stats", LIBRARIAN_DASH_SWR);

  const {
    data: invData,
    error: invError,
    isLoading: invLoading,
    isValidating: invValidating,
    mutate: mutateInv,
  } = useSWR<InventoryApiResponse>(
    "/api/admin/data?resource=inventory",
    LIBRARIAN_DASH_SWR
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

  // Inventory-based alerts matching legacy librarians/dashboard.html verbatim
  const alerts = useMemo<DashboardAlertItem[]>(() => {
    const list: DashboardAlertItem[] = [];
    if (inventoryRows.length === 0) return list;

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
        href: "/librarian/books",
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
        href: "/librarian/inventory",
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
        href: "/librarian/inventory",
      });
    }

    return list;
  }, [inventoryRows, invTotals]);

  const isRefreshing = statsValidating || invValidating;

  return (
    <StaffShell title="Dashboard" role="librarian">
      <div className="admin-dashboard-page overflow-x-clip">
        {/* Header */}
        <div className="mb-[22px] flex flex-wrap items-start justify-between gap-3">
          <div>
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
                Librarian <span style={{ color: "var(--accent)" }}>Dashboard</span>
              </span>
            </h1>
            <p className="mt-1 text-[0.84rem]" style={{ color: "var(--tl)" }}>
              Real-time overview of library resources and collection
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-bold"
              style={{
                backgroundColor: "rgba(62, 207, 142, 0.1)",
                border: "1px solid rgba(62, 207, 142, 0.22)",
                color: "var(--c-green)",
              }}
            >
              <span
                className="h-[7px] w-[7px] rounded-full animate-pulse"
                style={{ backgroundColor: "var(--c-green)" }}
                aria-hidden="true"
              />
              Auto-refresh every 60s
            </div>

            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-1.5 text-[0.82rem] font-semibold transition cursor-pointer disabled:opacity-60"
              style={{
                backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                border: "1px solid rgba(var(--accent-rgb), 0.25)",
                color: "var(--accent)",
              }}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
        </div>

        {/* 5 STAT CARDS */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <LibrarianKpiCard
            label="Total Books"
            value={stats ? stats.total_books : null}
            icon={BookOpen}
            iconBg="rgba(91, 155, 213, 0.18)"
            iconColor="var(--c-blue)"
            isLoading={statsLoading}
            delayMs={40}
          />
          <LibrarianKpiCard
            label="Available"
            value={!invLoading || stats ? invTotals.available : null}
            icon={CheckCircle2}
            iconBg="rgba(45, 212, 191, 0.18)"
            iconColor="var(--c-teal)"
            valueColor="var(--c-teal)"
            isLoading={invLoading && statsLoading}
            delayMs={80}
          />
          <LibrarianKpiCard
            label="Damaged"
            value={!invLoading || stats ? invTotals.damaged : null}
            icon={Wrench}
            iconBg="rgba(245, 166, 35, 0.18)"
            iconColor="var(--c-orange)"
            valueColor="var(--c-orange)"
            isLoading={invLoading && statsLoading}
            delayMs={120}
          />
          <LibrarianKpiCard
            label="Lost Copies"
            value={!invLoading || stats ? invTotals.lost : null}
            icon={HelpCircle}
            iconBg="rgba(247, 201, 72, 0.18)"
            iconColor="var(--c-gold)"
            valueColor="var(--c-gold)"
            isLoading={invLoading && statsLoading}
            delayMs={160}
          />
          <LibrarianKpiCard
            label="Registered Users"
            value={stats ? stats.total_users : null}
            icon={Users}
            iconBg="rgba(62, 207, 142, 0.18)"
            iconColor="var(--c-green)"
            isLoading={statsLoading}
            delayMs={200}
          />
        </div>

        {/* COLLECTION ANALYTICS */}
        <div className="dash-section-label">
          <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Collection Analytics</span>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BooksAddedChartCard
            booksPerDay={stats?.books_per_day}
            isLoading={statsLoading}
            hasError={Boolean(statsError)}
            onRetry={() => void mutateStats()}
            showMiniStats
          />
          <TopCategoriesCard
            rows={inventoryRows}
            isLoading={invLoading}
            hasError={Boolean(invError)}
            onRetry={() => void mutateInv()}
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
            isLoading={invLoading}
            partialWarning={
              invError ? "Inventory alerts unavailable (inventory request failed)." : null
            }
            emptyMessage="All inventory looks good!"
          />

          <BookAvailabilityTableCard
            rows={inventoryRows}
            isLoading={invLoading}
            hasError={Boolean(invError)}
            onRetry={() => void mutateInv()}
            viewAllHref="/librarian/books"
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
    </StaffShell>
  );
}
