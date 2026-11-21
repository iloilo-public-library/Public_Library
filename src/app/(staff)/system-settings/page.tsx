"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle2,
  Clock,
  CloudUpload,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
  X,
} from "lucide-react";
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

type SettingsTab = "maintenance" | "lockdown" | "backup";

const DEFAULT_MAINTENANCE_MSG =
  "The library system is currently under scheduled maintenance. We'll be back shortly. Thank you for your patience.";

const SCHEDULE_OPTIONS: { value: string; label: string }[] = [
  { value: "hourly", label: "Every Hour" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "off", label: "Off" },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SystemSettingsPage() {
  const { data, isLoading, mutate } = useSWR<SystemSettingsResponse>(
    "/api/admin/data?resource=system_settings",
    swrPrivateConfig
  );

  const [activeTab, setActiveTab] = useState<SettingsTab>("maintenance");
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [lockdownEnabled, setLockdownEnabled] = useState(false);
  const [bypassRole, setBypassRole] = useState("admin");
  const [backupFrequency, setBackupFrequency] = useState("weekly");
  const [maintenanceMessage, setMaintenanceMessage] = useState(DEFAULT_MAINTENANCE_MSG);
  const [bkpDatabase, setBkpDatabase] = useState(true);

  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [confirmLockModal, setConfirmLockModal] = useState<boolean>(false);
  const [pendingLockState, setPendingLockState] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!data?.settings) return;
    setMaintenanceEnabled(Boolean(data.settings.maintenance_enabled));
    setLockdownEnabled(Boolean(data.settings.lockdown_enabled));
    setBypassRole(data.settings.bypass_role || "admin");
    setBackupFrequency(data.settings.backup_frequency || "weekly");
    setMaintenanceMessage(data.settings.maintenance_message || DEFAULT_MAINTENANCE_MSG);
  }, [data?.settings]);

  const persistSettings = async (
    overrides?: Partial<{
      maintenance_enabled: boolean;
      lockdown_enabled: boolean;
      bypass_role: string;
      backup_frequency: string;
      maintenance_message: string;
    }>,
    successMsg = "System settings saved."
  ) => {
    setSaving(true);
    setFeedback(null);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "system_settings",
          action: "update",
          payload: {
            maintenance_enabled: overrides?.maintenance_enabled ?? maintenanceEnabled,
            lockdown_enabled: overrides?.lockdown_enabled ?? lockdownEnabled,
            bypass_role: overrides?.bypass_role ?? bypassRole,
            backup_frequency: overrides?.backup_frequency ?? backupFrequency,
            maintenance_message: overrides?.maintenance_message ?? maintenanceMessage,
          },
        },
      });
      await mutate();
      setFeedback({ ok: true, msg: successMsg });
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Failed to save system settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetMaintenance = () => {
    setMaintenanceEnabled(false);
    setBypassRole("admin");
    setMaintenanceMessage(DEFAULT_MAINTENANCE_MSG);
    setFeedback({
      ok: true,
      msg: "Maintenance fields reset to defaults. Click Save Changes to apply.",
    });
  };

  const openLockConfirm = (nextState: boolean) => {
    setPendingLockState(nextState);
    setConfirmLockModal(true);
  };

  const executeLockdown = async () => {
    if (pendingLockState === null) return;
    const next = pendingLockState;
    setConfirmLockModal(false);
    setPendingLockState(null);
    setLockdownEnabled(next);
    await persistSettings(
      { lockdown_enabled: next },
      next ? "Emergency Lockdown activated." : "Emergency Lockdown disabled."
    );
  };

  const handleRunBackup = async () => {
    if (!bkpDatabase) {
      setFeedback({ ok: false, msg: "Select Database scope before running a backup." });
      return;
    }
    setBackingUp(true);
    setFeedback(null);
    try {
      await apiMutate("/api/admin/data", {
        method: "POST",
        body: {
          resource: "system_settings",
          action: "run_backup",
          payload: { scope: "Database" },
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
  const activeScheduleLabel =
    SCHEDULE_OPTIONS.find((o) => o.value === backupFrequency)?.label || "Weekly";

  return (
    <StaffShell title="System Settings">
      {/* Emergency Lockdown Active Banner */}
      {lockdownEnabled && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-danger/45 bg-danger/12 px-4 py-3.5">
          <ShieldAlert className="h-5 w-5 shrink-0 text-danger" />
          <div>
            <div className="text-xs font-bold text-danger">Emergency Lockdown is ACTIVE</div>
            <div className="mt-0.5 text-[0.75rem] text-danger/80">
              All non-admin sessions are terminated. Login for non-admins is blocked.
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-accent">
            <Settings className="h-3 w-3" /> Admin Panel
          </span>
          <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-white">
            System <span className="text-accent">Settings</span>
          </h1>
          <p className="mt-1 text-[0.84rem] text-tl">
            Manage maintenance mode, access restrictions, emergency lockdown, and backup logs.
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

      {/* 3-Tab Switcher (legacy order: Maintenance | Emergency | Backup) */}
      <div
        role="tablist"
        aria-label="System settings tabs"
        className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-white/4 p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "maintenance"}
          onClick={() => setActiveTab("maintenance")}
          className={`flex flex-1 min-w-[110px] items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === "maintenance"
              ? "bg-accent/18 text-accent"
              : "text-tl/70 hover:bg-white/6 hover:text-white"
          }`}
        >
          <Wrench className="h-3.5 w-3.5" />
          <span>Maintenance</span>
          {maintenanceEnabled && <span className="h-2 w-2 rounded-full bg-warn" />}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "lockdown"}
          onClick={() => setActiveTab("lockdown")}
          className={`flex flex-1 min-w-[110px] items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === "lockdown"
              ? "bg-accent/18 text-accent"
              : "text-tl/70 hover:bg-white/6 hover:text-white"
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Emergency</span>
          {lockdownEnabled && <span className="h-2 w-2 rounded-full bg-danger" />}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "backup"}
          onClick={() => setActiveTab("backup")}
          className={`flex flex-1 min-w-[110px] items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === "backup"
              ? "bg-accent/18 text-accent"
              : "text-tl/70 hover:bg-white/6 hover:text-white"
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          <span>Backup</span>
        </button>
      </div>

      {/* TAB 1: MAINTENANCE */}
      {activeTab === "maintenance" && (
        <div className="rounded-2xl border border-white/10 bg-card-glass overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Maintenance Mode</h2>
                <p className="text-xs text-tl/65">
                  Temporarily restrict access while the system is being updated.
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider ${
                maintenanceEnabled
                  ? "border border-warn/30 bg-warn/15 text-warn"
                  : "bg-white/8 text-tl/60"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  maintenanceEnabled ? "bg-warn" : "bg-white/40"
                }`}
              />
              {maintenanceEnabled ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="space-y-5 p-6">
            {/* Master Toggle */}
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-xs font-semibold text-white">Enable Maintenance Mode</div>
                <div className="mt-0.5 text-[0.75rem] text-tl/65">
                  When active, non-authorized users will see a maintenance page and cannot access
                  the system.
                </div>
              </div>
              <input
                type="checkbox"
                checked={maintenanceEnabled}
                onChange={(e) => setMaintenanceEnabled(e.target.checked)}
                className="h-4 w-4 accent-[var(--warn)] cursor-pointer"
              />
            </label>

            <hr className="border-white/8" />

            {/* Message + Preview */}
            <div>
              <label className="mb-2 block font-mono text-[0.68rem] font-bold uppercase tracking-wider text-accent/75">
                Maintenance Page Message
              </label>
              <textarea
                rows={3}
                maxLength={300}
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="e.g. The library system is currently under maintenance."
                className="w-full rounded-xl border border-white/12 bg-bg1/80 px-3.5 py-2.5 text-xs text-white placeholder:text-tl/45 focus:border-accent/55 focus:outline-none"
              />
              <div className="mt-1 text-right font-mono text-[0.7rem] text-tl/50">
                {maintenanceMessage.length} / 300
              </div>

              <div className="mt-4">
                <div className="mb-2 font-mono text-[0.68rem] font-bold uppercase tracking-wider text-accent/75">
                  Preview
                </div>
                <div className="rounded-xl border border-white/10 bg-white/4 p-4">
                  <div className="mb-2.5 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warn/15 text-warn">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">System Under Maintenance</div>
                      <div className="text-[0.72rem] text-tl/55">
                        Shown to non-authorized users
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-white/8 pt-2.5 text-xs leading-relaxed text-tl/75">
                    {maintenanceMessage || "(no message set)"}
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-white/8" />

            {/* Access & Bypass Permissions */}
            <div>
              <div className="mb-1 font-mono text-[0.68rem] font-bold uppercase tracking-wider text-accent/75">
                Access &amp; Bypass Permissions
              </div>
              <p className="mb-3 text-xs text-tl/60">
                Choose which roles can bypass maintenance mode and still access the system.
              </p>

              <div className="space-y-2.5 rounded-xl border border-accent/15 bg-accent/5 p-4">
                <label
                  className={`flex items-center gap-3 rounded-xl border p-3.5 transition cursor-pointer ${
                    bypassRole === "admin"
                      ? "border-accent/45 bg-accent/12"
                      : "border-white/10 bg-white/4 hover:bg-white/6"
                  }`}
                >
                  <input
                    type="radio"
                    name="bypass_role"
                    value="admin"
                    checked={bypassRole === "admin"}
                    onChange={() => setBypassRole("admin")}
                    className="accent-[var(--accent)]"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <ShieldCheck className="h-3.5 w-3.5 text-warn" /> Admin Only
                    </div>
                    <div className="mt-0.5 text-[0.74rem] text-tl/65">
                      Only administrators can access the system during maintenance.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 rounded-xl border p-3.5 transition cursor-pointer ${
                    bypassRole === "admin_librarian"
                      ? "border-accent/45 bg-accent/12"
                      : "border-white/10 bg-white/4 hover:bg-white/6"
                  }`}
                >
                  <input
                    type="radio"
                    name="bypass_role"
                    value="admin_librarian"
                    checked={bypassRole === "admin_librarian"}
                    onChange={() => setBypassRole("admin_librarian")}
                    className="accent-[var(--accent)]"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <Users className="h-3.5 w-3.5 text-accent2" /> Admin + Librarian
                    </div>
                    <div className="mt-0.5 text-[0.74rem] text-tl/65">
                      Administrators and librarians can both access during maintenance.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Role Access Summary */}
            <div>
              <div className="mb-2.5 font-mono text-[0.68rem] font-bold uppercase tracking-wider text-accent/75">
                Role Access Summary
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/8 bg-white/4 p-3.5">
                  <div className="mb-2 font-mono text-[0.68rem] font-bold uppercase text-warn/80">
                    Admin
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent2/25 bg-accent2/12 px-2.5 py-0.5 text-[0.68rem] font-bold uppercase text-accent2">
                    Always Access
                  </span>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/4 p-3.5">
                  <div className="mb-2 font-mono text-[0.68rem] font-bold uppercase text-accent/70">
                    Librarian
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase ${
                      bypassRole === "admin_librarian"
                        ? "border border-accent2/25 bg-accent2/12 text-accent2"
                        : "bg-white/8 text-tl/60"
                    }`}
                  >
                    {bypassRole === "admin_librarian" ? "Bypass Allowed" : "Depends on bypass"}
                  </span>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/4 p-3.5">
                  <div className="mb-2 font-mono text-[0.68rem] font-bold uppercase text-accent/70">
                    Member
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/25 bg-danger/12 px-2.5 py-0.5 text-[0.68rem] font-bold uppercase text-danger">
                    Blocked
                  </span>
                </div>
              </div>
            </div>

            <hr className="border-white/8" />

            <div className="flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent/8 px-4 py-3 text-xs leading-relaxed text-tl/80">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                Admins always retain full dashboard access during maintenance. Emergency lockdown
                overrides all settings and blocks every non-admin user.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                type="button"
                variant="accent"
                size="sm"
                disabled={saving}
                onClick={() => persistSettings(undefined, "Maintenance settings saved.")}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save Changes
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={handleResetMaintenance}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to Default
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMERGENCY */}
      {activeTab === "lockdown" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-danger/25 bg-card-glass overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-danger/15 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/15 text-danger">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Emergency Lockdown Mode</h2>
                  <p className="text-xs text-tl/65">
                    Immediately terminate all non-admin sessions and block login access.
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider ${
                  lockdownEnabled
                    ? "border border-danger/35 bg-danger/15 text-danger"
                    : "bg-white/8 text-tl/60"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    lockdownEnabled ? "bg-danger" : "bg-white/40"
                  }`}
                />
                {lockdownEnabled ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/8 px-4 py-3 text-xs leading-relaxed text-danger/90">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <div>
                  <strong>Critical Action:</strong> Enabling lockdown will immediately log out ALL
                  active non-admin sessions and prevent any non-admin user from logging in. This
                  overrides maintenance mode and access restriction settings.
                </div>
              </div>

              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Activate Emergency Lockdown
                  </div>
                  <div className="mt-0.5 text-[0.75rem] text-tl/65">
                    When enabled, all librarians and members are immediately logged out and cannot
                    log back in until this is disabled.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={lockdownEnabled}
                  onChange={(e) => openLockConfirm(e.target.checked)}
                  className="h-4 w-4 accent-[var(--danger)] cursor-pointer"
                />
              </label>

              <hr className="border-white/8" />

              <div>
                <div className="mb-2.5 font-mono text-[0.68rem] font-bold uppercase tracking-wider text-accent/75">
                  Lockdown Effects
                </div>
                <div className="space-y-2 text-xs">
                  <div className="rounded-xl border border-danger/18 bg-danger/6 px-3.5 py-2.5 text-danger/85">
                    All non-admin active sessions are <strong>immediately terminated</strong>
                  </div>
                  <div className="rounded-xl border border-danger/18 bg-danger/6 px-3.5 py-2.5 text-danger/85">
                    Login page shows:{" "}
                    <em>&ldquo;System is temporarily locked for security reasons&rdquo;</em>
                  </div>
                  <div className="rounded-xl border border-danger/18 bg-danger/6 px-3.5 py-2.5 text-danger/85">
                    Overrides maintenance mode — maintenance settings are ignored while lockdown is
                    active
                  </div>
                  <div className="rounded-xl border border-accent2/20 bg-accent2/8 px-3.5 py-2.5 text-accent2/90">
                    Admin accounts retain full access to all system functions
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn/8 px-4 py-3 text-xs leading-relaxed text-warn/90">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                <span>
                  Use this feature only in genuine security emergencies. Disable it as soon as the
                  situation is resolved to restore normal access.
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={saving}
                  onClick={() => openLockConfirm(!lockdownEnabled)}
                >
                  <Lock className="h-3.5 w-3.5" />
                  {lockdownEnabled ? "Disable Lockdown" : "Activate Lockdown"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab("backup")}
                >
                  <Archive className="h-3.5 w-3.5" />
                  View Backup Log
                </Button>
              </div>
            </div>
          </div>

          {/* Recent Lockdown Events */}
          <div className="rounded-2xl border border-white/10 bg-card-glass overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/8 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warn/15 text-warn">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Recent Lockdown Events</h2>
                <p className="text-xs text-tl/65">
                  History of emergency lockdown activations and deactivations.
                </p>
              </div>
            </div>
            <div className="px-6 py-8 text-center text-xs text-tl/55">
              No lockdown events recorded (lockdown history logging not available yet).
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BACKUP */}
      {activeTab === "backup" && (
        <div className="space-y-5">
          {/* System Backup Card */}
          <div className="rounded-2xl border border-white/10 bg-card-glass overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Archive className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">System Backup</h2>
                  <p className="text-xs text-tl/65">
                    Create a manual backup of the database and system files.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-tl/65">
                {backingUp ? "Running" : "Idle"}
              </span>
            </div>

            <div className="space-y-4 p-6">
              <div className="font-mono text-[0.68rem] font-bold uppercase tracking-wider text-accent/75">
                Backup Scope
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 p-3.5 cursor-pointer hover:bg-white/6">
                  <input
                    type="checkbox"
                    checked={bkpDatabase}
                    onChange={(e) => setBkpDatabase(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">Database</div>
                    <div className="text-[0.72rem] text-tl/60">All tables &amp; records</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-3.5 opacity-60 cursor-not-allowed">
                  <input
                    type="checkbox"
                    disabled
                    checked={false}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <span>System Files</span>
                      <span className="rounded-full border border-white/15 bg-white/6 px-2 py-0.5 text-[0.62rem] text-tl/70">
                        Not available yet
                      </span>
                    </div>
                    <div className="text-[0.72rem] text-tl/60">Config &amp; static assets</div>
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  disabled={backingUp}
                  onClick={handleRunBackup}
                >
                  {backingUp ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CloudUpload className="h-3.5 w-3.5" />
                  )}
                  Backup Now
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled
                  title="Clear Log History is not available yet"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Log History (Not available yet)
                </Button>
              </div>
            </div>
          </div>

          {/* Automatic Backup Schedule Card */}
          <div className="rounded-2xl border border-white/10 bg-card-glass overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Automatic Backup Schedule</h2>
                  <p className="text-xs text-tl/65">
                    Set how often the system creates automatic backups.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent2/30 bg-accent2/12 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-accent2">
                {activeScheduleLabel}
              </span>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <div className="mb-2.5 font-mono text-[0.68rem] font-bold uppercase tracking-wider text-accent/75">
                  Frequency
                </div>
                <div className="flex flex-wrap gap-2">
                  {SCHEDULE_OPTIONS.map((opt) => {
                    const active = backupFrequency === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBackupFrequency(opt.value)}
                        className={`rounded-xl border px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                          active
                            ? "border-accent/45 bg-accent/18 text-accent"
                            : "border-white/10 bg-white/5 text-tl/70 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 opacity-60">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <span>Notify admin after each backup</span>
                    <span className="rounded-full border border-white/15 bg-white/6 px-2 py-0.5 text-[0.62rem] text-tl/70">
                      Not available yet
                    </span>
                  </div>
                  <div className="mt-0.5 text-[0.74rem] text-tl/60">
                    Send a system notification when an automatic backup completes.
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  aria-label="Notify admin after each backup (not available yet)"
                  className="h-4 w-4 cursor-not-allowed"
                />
              </div>

              <hr className="border-white/8" />

              <div className="flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent/8 px-4 py-3 text-xs leading-relaxed text-tl/80">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>
                  Automatic backups run in the background and do not interrupt system usage. Backup
                  files are stored in <code className="font-mono text-accent">/backups/</code> on
                  the server.
                </span>
              </div>

              <div>
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  disabled={saving}
                  onClick={() => persistSettings(undefined, "Backup schedule saved.")}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save Schedule
                </Button>
              </div>
            </div>
          </div>

          {/* Backup Log Table */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-glass">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-6 py-4">
              <div>
                <h2 className="text-sm font-bold text-white">Backup Log</h2>
                <p className="text-xs text-tl/65">
                  History of all backup operations — manual and automatic.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-tl/60">
                  {logs.length} {logs.length === 1 ? "entry" : "entries"}
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={() => mutate()}>
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/8 bg-white/4 font-mono text-[0.7rem] uppercase text-white/55">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">File Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Scope</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-tl">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-tl/60">
                        No backup logs yet. Run your first backup above.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/4">
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
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
                        <td className="px-4 py-3 font-mono text-white">{log.file_name}</td>
                        <td className="px-4 py-3 capitalize">{log.backup_type}</td>
                        <td className="px-4 py-3">{log.scope}</td>
                        <td className="px-4 py-3 font-mono text-tl/75">
                          {formatBytes(log.file_size_bytes)}
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Emergency Lockdown */}
      {confirmLockModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lockdown-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-accent/25 bg-modal p-6 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-danger/15 text-danger">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 id="lockdown-confirm-title" className="text-base font-bold text-white">
              {pendingLockState
                ? "Activate Emergency Lockdown?"
                : "Disable Emergency Lockdown?"}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-tl/75">
              {pendingLockState
                ? "This will immediately log out all librarians and members. They will not be able to log back in until lockdown is disabled. Admin access is unaffected. Are you sure you want to proceed?"
                : "Disabling lockdown will restore normal login access for librarians and members. Are you sure you want to proceed?"}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setConfirmLockModal(false);
                  setPendingLockState(null);
                }}
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={executeLockdown}>
                <Lock className="h-3.5 w-3.5" />
                {pendingLockState ? "Yes, Activate" : "Yes, Disable"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
