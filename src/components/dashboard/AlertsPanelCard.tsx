"use client";

import Link from "next/link";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  HelpCircle,
  Lock,
  ShieldAlert,
  WifiOff,
  Wrench,
} from "lucide-react";
import type { DashboardAlertItem } from "./types";

interface AlertsPanelCardProps {
  alerts: DashboardAlertItem[];
  isLoading: boolean;
  partialWarning?: string | null;
  emptyMessage?: string;
}

const ALERT_ICONS: Record<DashboardAlertItem["icon"], typeof Lock> = {
  lock: Lock,
  "wifi-off": WifiOff,
  shield: ShieldAlert,
  "out-of-stock": AlertCircle,
  damaged: Wrench,
  lost: HelpCircle,
};

export function AlertsPanelCard({
  alerts,
  isLoading,
  partialWarning,
  emptyMessage = "All systems look good!",
}: AlertsPanelCardProps) {
  const count = alerts.length;
  const allClear = !isLoading && count === 0;

  return (
    <div className="dash-chart-card">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <h2
          className="flex items-center gap-2 text-[0.76rem] font-bold uppercase tracking-[0.07em]"
          style={{ color: "var(--dash-text-primary)" }}
        >
          <span
            className="flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-[7px]"
            style={{
              backgroundColor: "rgba(224, 84, 84, 0.15)",
              color: "var(--c-red)",
            }}
          >
            <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          Alerts &amp; Attention
        </h2>

        <span
          className="dash-tabular rounded-full px-2 py-0.5 text-[0.64rem] font-bold"
          style={
            allClear
              ? {
                  backgroundColor: "rgba(62, 207, 142, 0.13)",
                  color: "var(--c-green)",
                  border: "1px solid rgba(62, 207, 142, 0.24)",
                }
              : {
                  backgroundColor: "rgba(224, 84, 84, 0.13)",
                  color: "var(--c-red)",
                  border: "1px solid rgba(224, 84, 84, 0.24)",
                }
          }
        >
          {count} {count === 1 ? "issue" : "issues"}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2.5 py-2">
          {[1, 2, 3].map((k) => (
            <div
              key={k}
              className="h-14 w-full animate-pulse rounded-[10px]"
              style={{ backgroundColor: "var(--dash-track-bg)" }}
            />
          ))}
        </div>
      ) : count === 0 ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center text-[0.8rem]"
          style={{ color: "var(--dash-text-muted)" }}
        >
          <CheckCircle2
            className="h-8 w-8"
            style={{ color: "var(--c-green)" }}
            aria-hidden="true"
          />
          <span>{emptyMessage}</span>
          {partialWarning && (
            <span className="text-[0.72rem]" style={{ color: "var(--c-orange)" }}>
              {partialWarning}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-1 flex flex-col gap-2">
          {alerts.map((alert) => {
            const Icon = ALERT_ICONS[alert.icon];
            const isDanger = alert.severity === "danger";
            const color = isDanger
              ? "var(--c-red)"
              : alert.severity === "warn"
              ? "var(--c-orange)"
              : "var(--c-blue)";
            const bg = isDanger
              ? "rgba(224, 84, 84, 0.07)"
              : alert.severity === "warn"
              ? "rgba(245, 166, 35, 0.07)"
              : "rgba(91, 155, 213, 0.07)";
            const border = isDanger
              ? "rgba(224, 84, 84, 0.26)"
              : alert.severity === "warn"
              ? "rgba(245, 166, 35, 0.26)"
              : "rgba(91, 155, 213, 0.26)";

            const inner = (
              <>
                <Icon
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color }}
                  aria-hidden="true"
                />
                <div
                  className="text-[0.78rem] leading-[1.45]"
                  style={{ color: "var(--dash-text-secondary)" }}
                >
                  <strong
                    className="mb-0.5 block font-bold"
                    style={{ color: "var(--dash-text-primary)" }}
                  >
                    {alert.title}
                  </strong>
                  {alert.body}
                </div>
              </>
            );

            return alert.href ? (
              <Link
                key={alert.id}
                href={alert.href}
                className="flex min-h-[44px] items-start gap-2.5 rounded-[10px] px-3 py-2.5 transition hover:opacity-90"
                style={{ backgroundColor: bg, border: `1px solid ${border}` }}
              >
                {inner}
              </Link>
            ) : (
              <div
                key={alert.id}
                className="flex items-start gap-2.5 rounded-[10px] px-3 py-2.5"
                style={{ backgroundColor: bg, border: `1px solid ${border}` }}
              >
                {inner}
              </div>
            );
          })}
          {partialWarning && (
            <p className="pt-1 text-[0.72rem]" style={{ color: "var(--c-orange)" }}>
              {partialWarning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
