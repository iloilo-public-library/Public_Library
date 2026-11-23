"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  CheckCircle2,
  Download,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { Button } from "@/components/ui/button";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { apiMutate, swrPrivateConfig } from "@/lib/api";

interface ErrorLogRow {
  id: string;
  level: "error" | "security" | "warning" | "info";
  source: string;
  route: string;
  method: string;
  status_code: number;
  message: string;
  details: string;
  user_email: string;
  resolved: boolean;
  created_at: string;
  persistent?: boolean;
}

export default function AdminErrorLogsPage() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [inspectRow, setInspectRow] = useState<ErrorLogRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null);

  const { data, error, isLoading, mutate } = useSWR<{ rows?: ErrorLogRow[] }>(
    "/api/admin/data?resource=error_logs",
    swrPrivateConfig
  );

  const rows = data?.rows ?? [];

  const counts = useMemo(() => {
    return {
      total: rows.length,
      errors: rows.filter((r) => r.level === "error").length,
      security: rows.filter((r) => r.level === "security").length,
      warnings: rows.filter((r) => r.level === "warning").length,
    };
  }, [rows]);

  const sources = useMemo(() => {
    const s = new Set<string>(["API", "Auth", "Client", "Backup", "Database", "404"]);
    for (const r of rows) {
      if (r.source) s.add(r.source);
    }
    return Array.from(s);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (levelFilter !== "all" && r.level !== levelFilter) return false;
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        r.message.toLowerCase().includes(q) ||
        r.route.toLowerCase().includes(q) ||
        r.user_email.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [rows, levelFilter, sourceFilter, search]);

  const mutateLog = async (
    method: "POST" | "PUT" | "DELETE",
    action: string,
    id: string | null,
    payload: Record<string, unknown>,
    successMsg: string
  ) => {
    setBusy(true);
    setBanner(null);
    try {
      await apiMutate("/api/admin/data", {
        method,
        body: { resource: "error_logs", action, id, payload },
      });
      await mutate();
      setBanner({ ok: true, msg: successMsg });
    } catch (err) {
      setBanner({
        ok: false,
        msg: err instanceof Error ? err.message : "Operation failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `icpl-error-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const badgeTone = (level: ErrorLogRow["level"]) => {
    if (level === "error") return "border-danger/35 bg-danger/15 text-danger";
    if (level === "security") return "border-warn/40 bg-warn/18 text-warn";
    if (level === "warning") return "border-gold/35 bg-gold/12 text-gold";
    return "border-accent/30 bg-accent/12 text-accent";
  };

  return (
    <StaffShell title="Error & Security Logs">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-white">
            Error &amp; <span className="text-accent">Security Logs</span>
          </h1>
          <p className="mt-1 text-[0.84rem] text-tl">
            Real-time runtime exceptions, 404 misses, authentication failures, and backup alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() =>
              mutateLog(
                "POST",
                "test",
                null,
                {
                  level: "error",
                  source: "API",
                  route: "/api/admin/data",
                  method: "POST",
                  status_code: 500,
                  message: "Diagnostic test error event triggered from Error Logs dashboard",
                },
                "Simulated test error recorded."
              )
            }
          >
            <Bug className="h-3.5 w-3.5" />
            Test Log
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportJson}>
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy || rows.length === 0}
            onClick={() =>
              mutateLog("DELETE", "clear", null, {}, "Cleared runtime error log entries.")
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Logs
          </Button>
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {banner && (
        <div
          className={`mb-5 flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs ${
            banner.ok
              ? "border-accent2/30 bg-accent2/12 text-accent2"
              : "border-danger/30 bg-danger/12 text-danger"
          }`}
        >
          <span>{banner.msg}</span>
          <button type="button" onClick={() => setBanner(null)} className="cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Total Events",
            value: counts.total,
            icon: AlertCircle,
            tone: "text-accent bg-accent/15 border-accent/25",
          },
          {
            label: "Runtime & API Errors",
            value: counts.errors,
            icon: Bug,
            tone: "text-danger bg-danger/15 border-danger/25",
          },
          {
            label: "Security Alerts",
            value: counts.security,
            icon: ShieldAlert,
            tone: "text-warn bg-warn/15 border-warn/25",
          },
          {
            label: "Warnings & 404s",
            value: counts.warnings,
            icon: AlertTriangle,
            tone: "text-gold bg-gold/15 border-gold/25",
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-card-glass p-4 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[0.68rem] uppercase tracking-wider text-tl/70">
                {label}
              </span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${tone}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Unified Browse-Catalog Command Search & Severity/Source Filter Bar */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="group relative flex-1">
          <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-accent/20 via-accent2/10 to-accent/20 opacity-0 blur transition duration-300 group-focus-within:opacity-100" />
          <div className="relative flex h-[48px] items-center rounded-2xl border border-white/12 bg-bg1/90 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-200 focus-within:border-accent/50 focus-within:bg-bg1">
            <Search className="h-4.5 w-4.5 shrink-0 text-accent/80" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search route, error message, user email, or event ID..."
              className="w-full bg-transparent py-2 pl-3 pr-3 text-[0.9rem] text-white placeholder:text-white/38 focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/8 text-white/60 transition hover:bg-white/15 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[0.68rem] font-medium text-white/45 sm:inline-flex">
                <span>⌘K</span>
              </kbd>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["all", "error", "security", "warning"].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`inline-flex h-[48px] cursor-pointer items-center rounded-2xl border px-4 text-xs font-semibold capitalize transition-all ${
                levelFilter === lvl
                  ? "border-accent/45 bg-accent/15 text-accent shadow-[0_0_20px_rgba(147,197,253,0.14)]"
                  : "border-white/12 bg-bg1/85 text-white/80 hover:border-white/22 hover:bg-white/8 hover:text-white"
              }`}
            >
              {lvl === "all" ? "All Levels" : lvl}
            </button>
          ))}

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="h-[48px] rounded-2xl border border-white/12 bg-bg1/85 px-4 text-xs font-semibold text-white focus:border-accent/50 focus:outline-none"
          >
            <option value="all" className="bg-modal text-white">
              Source: All
            </option>
            {sources.map((src) => (
              <option key={src} value={src} className="bg-modal text-white">
                Source: {src}
              </option>
            ))}
          </select>

          <div className="ml-auto flex h-[48px] items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 text-xs text-tl lg:ml-0">
            <span className="whitespace-nowrap">
              <strong className="font-semibold text-white">{filtered.length}</strong> /{" "}
              {rows.length}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger/25 bg-danger/10 p-5 text-sm text-danger">
          <span>{error.message || "Unable to load error logs."}</span>
          <Button variant="accent" size="sm" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2.5 rounded-2xl border border-white/8 bg-card-glass p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-white/6" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-card-glass p-12 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-accent2/60" />
          <h3 className="text-sm font-bold text-white">No error events matching filters</h3>
          <p className="mt-1 text-xs text-tl/70">
            All monitored endpoints, auth checks, and backup routines are clean.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-glass backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/4 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-accent">
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {filtered.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-white/5">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[0.66rem] font-bold uppercase ${badgeTone(
                          row.level
                        )}`}
                      >
                        {row.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-white">{row.source}</td>
                    <td className="px-4 py-3 font-mono text-tl">{row.status_code}</td>
                    <td className="px-4 py-3 font-mono text-[0.72rem] text-accent">
                      {row.method} {row.route.length > 28 ? `${row.route.slice(0, 28)}…` : row.route}
                    </td>
                    <td className="px-4 py-3 text-tl">
                      {row.message.length > 56 ? `${row.message.slice(0, 56)}…` : row.message}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[0.66rem] font-bold ${
                          row.resolved
                            ? "border-accent2/30 bg-accent2/15 text-accent2"
                            : "border-warn/30 bg-warn/12 text-warn"
                        }`}
                      >
                        {row.resolved ? "Resolved" : "Open"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[0.72rem] text-tl/75 whitespace-nowrap">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <LibraryTooltip label="Inspect Trace / Details">
                          <button
                            type="button"
                            onClick={() => setInspectRow(row)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-tl/80 transition hover:border-accent/40 hover:text-accent cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </LibraryTooltip>
                        <LibraryTooltip label={row.resolved ? "Reopen Event" : "Mark Resolved"}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              mutateLog(
                                "PUT",
                                "resolve",
                                row.id,
                                { resolved: !row.resolved },
                                `Log ${row.id} marked ${!row.resolved ? "resolved" : "open"}.`
                              )
                            }
                            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition cursor-pointer ${
                              row.resolved
                                ? "border-accent2/35 bg-accent2/15 text-accent2"
                                : "border-white/10 bg-white/5 text-tl/70 hover:text-accent2"
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        </LibraryTooltip>
                        <LibraryTooltip label="Delete Event">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              mutateLog("DELETE", "delete", row.id, {}, `Log ${row.id} deleted.`)
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-danger/25 bg-danger/10 text-danger transition hover:bg-danger/20 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </LibraryTooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect Stack / Details Dialog */}
      <Dialog open={inspectRow !== null} onOpenChange={(o) => !o && setInspectRow(null)}>
        <DialogContent className="max-w-[620px] p-0">
          <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-white">
              <Bug className="h-4 w-4 text-accent" /> Error Event {inspectRow?.id}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Full diagnostic payload and trace information
            </DialogDescription>
            <button
              type="button"
              onClick={() => setInspectRow(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-white/60 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {inspectRow && (
            <div className="space-y-3 p-6 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/8 bg-bg1/60 p-3">
                  <div className="font-mono text-[0.65rem] uppercase text-accent">Route</div>
                  <div className="mt-1 font-mono text-white">
                    {inspectRow.method} {inspectRow.route}
                  </div>
                </div>
                <div className="rounded-xl border border-white/8 bg-bg1/60 p-3">
                  <div className="font-mono text-[0.65rem] uppercase text-accent">Actor / User</div>
                  <div className="mt-1 font-mono text-white">
                    {inspectRow.user_email || "system"}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-danger/25 bg-danger/10 p-3.5">
                <div className="font-mono text-[0.65rem] uppercase text-danger">Message</div>
                <div className="mt-1 text-white">{inspectRow.message}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-bg1/75 p-3.5">
                <div className="font-mono text-[0.65rem] uppercase text-accent">
                  Diagnostic Details / Stack
                </div>
                <pre className="mt-1.5 max-h-[220px] overflow-auto whitespace-pre-wrap font-mono text-[0.7rem] text-tl/85">
                  {inspectRow.details || "No stack trace recorded for this event."}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </StaffShell>
  );
}
