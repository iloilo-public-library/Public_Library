"use client";

import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  Save,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { StaffShell } from "@/components/layout/StaffShell";
import { Button } from "@/components/ui/button";
import { apiMutate, swrPrivateConfig } from "@/lib/api";

interface SystemSettingsResponse {
  settings: {
    maintenance_enabled: boolean;
    maintenance_message: string;
    bypass_role: string;
    lockdown_enabled: boolean;
    backup_frequency: string;
    updated_at: string | null;
  } | null;
  backupLogs: {
    id: number;
    backup_type: string;
    scope: string;
    file_name: string;
    file_size_bytes: number;
    dropbox_path: string;
    status: string;
    created_at: string;
  }[];
  errorCount?: number;
}

export default function SystemSettingsPage() {
  const { data, isLoading, mutate } = useSWR<SystemSettingsResponse>(
    "/api/admin/data?resource=system_settings",
    swrPrivateConfig
  );

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [lockdownEnabled, setLockdownEnabled] = useState(false);
  const [bypassRole, setBypassRole] = useState("admin");
  const [backupFrequency, setBackupFrequency] = useState("weekly");
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!data?.settings) return;
    setMaintenanceEnabled(Boolean(data.settings.maintenance_enabled));
    setLockdownEnabled(Boolean(data.settings.lockdown_enabled));
    setBypassRole(data.settings.bypass_role || "admin");
    setBackupFrequency(data.settings.backup_frequency || "weekly");
    setMaintenanceMessage(data.settings.maintenance_message || "");
  }, [data?.settings]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "system_settings",
          action: "update",
          payload: {
            maintenance_enabled: maintenanceEnabled,
            lockdown_enabled: lockdownEnabled,
            bypass_role: bypassRole,
            backup_frequency: backupFrequency,
            maintenance_message: maintenanceMessage,
          },
        },
      });
      await mutate();
      setFeedback({ ok: true, msg: "System settings saved to Supabase." });
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Failed to save system settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRunBackup = async () => {
    setBackingUp(true);
    setFeedback(null);
    try {
      await apiMutate("/api/admin/data", {
        method: "POST",
        body: {
          resource: "system_settings",
          action: "run_backup",
          payload: { scope: "Database + System Metadata" },
        },
      });
      await mutate();
      setFeedback({ ok: true, msg: "Manual backup snapshot logged successfully." });
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Failed to run backup.",
      });
    } finally {
      setBackingUp(false);
    }
  };

  const logs = data?.backupLogs ?? [];

  return (
    <StaffShell title="System Settings">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-white">
            System <span className="text-accent">Settings</span>
          </h1>
          <p className="mt-1 text-[0.84rem] text-tl">
            Security lockdown controls, maintenance mode gate, and backup snapshot logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/admin/error-logs">
              <AlertCircle className="h-3.5 w-3.5 text-warn" />
              Error Logs ({data?.errorCount ?? 0})
            </Link>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs ${
            feedback.ok
              ? "border-accent2/30 bg-accent2/12 text-accent2"
              : "border-danger/30 bg-danger/12 text-danger"
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* KPI Status Strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-card-glass p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-tl/65">Lockdown Mode</span>
            <ShieldAlert className={`h-5 w-5 ${lockdownEnabled ? "text-danger" : "text-accent2"}`} />
          </div>
          <div className="text-lg font-bold text-white">
            {isLoading ? "Loading..." : lockdownEnabled ? "EMERGENCY LOCKDOWN" : "Normal"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card-glass p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-tl/65">Maintenance Mode</span>
            <Wrench className={`h-5 w-5 ${maintenanceEnabled ? "text-warn" : "text-accent2"}`} />
          </div>
          <div className="text-lg font-bold text-white">
            {isLoading ? "Loading..." : maintenanceEnabled ? "ACTIVE" : "Operational"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card-glass p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-tl/65">Backup Schedule</span>
            <HardDrive className="h-5 w-5 text-accent2" />
          </div>
          <div className="text-lg font-bold capitalize text-white">
            {isLoading ? "Loading..." : backupFrequency || "Weekly"}
          </div>
        </div>
      </div>

      {/* Interactive Configuration Form */}
      <form
        onSubmit={handleSave}
        className="mb-6 rounded-2xl border border-white/10 bg-card-glass p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-3">
          <h2 className="text-sm font-bold text-white">Gate &amp; Maintenance Controls</h2>
          <Button type="submit" variant="accent" size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Configuration
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-bg1/60 p-4 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-white">Enable Maintenance Mode</div>
              <div className="mt-1 text-[0.74rem] text-tl/70">
                Display the maintenance notice to patrons while staff retain access.
              </div>
            </div>
            <input
              type="checkbox"
              checked={maintenanceEnabled}
              onChange={(e) => setMaintenanceEnabled(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--warn)]"
            />
          </label>

          <label className="flex items-start justify-between gap-3 rounded-xl border border-danger/25 bg-danger/8 p-4 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-danger">Emergency Lockdown</div>
              <div className="mt-1 text-[0.74rem] text-tl/70">
                Immediately block patron &amp; non-admin logins during security incidents.
              </div>
            </div>
            <input
              type="checkbox"
              checked={lockdownEnabled}
              onChange={(e) => setLockdownEnabled(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--danger)]"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-tl">Bypass Role</label>
            <select
              value={bypassRole}
              onChange={(e) => setBypassRole(e.target.value)}
              className="w-full rounded-xl border border-white/12 bg-bg1/80 px-3.5 py-2.5 text-xs text-white focus:border-accent/55 focus:outline-none"
            >
              <option value="admin" className="bg-modal text-white">
                Administrators Only
              </option>
              <option value="admin_librarian" className="bg-modal text-white">
                Administrators &amp; Librarians
              </option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-tl">
              Automated Backup Frequency
            </label>
            <select
              value={backupFrequency}
              onChange={(e) => setBackupFrequency(e.target.value)}
              className="w-full rounded-xl border border-white/12 bg-bg1/80 px-3.5 py-2.5 text-xs text-white focus:border-accent/55 focus:outline-none"
            >
              {["hourly", "daily", "weekly", "monthly", "off"].map((f) => (
                <option key={f} value={f} className="bg-modal text-white capitalize">
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-tl">
            Maintenance Banner Message
          </label>
          <textarea
            rows={2}
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            placeholder="The library system is currently under scheduled maintenance..."
            className="w-full rounded-xl border border-white/12 bg-bg1/80 px-3.5 py-2.5 text-xs text-white placeholder:text-tl/45 focus:border-accent/55 focus:outline-none"
          />
        </div>
      </form>

      {/* Backup Logs */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-glass">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-5 py-3.5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent">
            <Database className="h-4 w-4" /> Backup Snapshot Logs
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={backingUp}
            onClick={handleRunBackup}
          >
            {backingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run Manual Snapshot
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/8 bg-white/4 font-mono text-[0.7rem] uppercase text-white/55">
                <th className="px-4 py-3">File Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Archive Path</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-tl">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-tl/60">
                    No backup logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/4">
                    <td className="px-4 py-3 font-mono text-white">{log.file_name}</td>
                    <td className="px-4 py-3 capitalize">{log.backup_type}</td>
                    <td className="px-4 py-3">{log.scope}</td>
                    <td className="px-4 py-3 font-mono text-[0.72rem] text-tl/70">
                      {log.dropbox_path || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold uppercase ${
                          log.status === "success"
                            ? "border-accent2/30 bg-accent2/15 text-accent2"
                            : "border-danger/30 bg-danger/15 text-danger"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </StaffShell>
  );
}
