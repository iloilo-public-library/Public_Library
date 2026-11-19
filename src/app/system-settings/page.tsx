"use client";

import useSWR from "swr";
import { Database, HardDrive, ShieldAlert, Wrench } from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { swrPrivateConfig } from "@/lib/api";

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
    status: string;
    created_at: string;
  }[];
}

export default function SystemSettingsPage() {
  const { data, isLoading } = useSWR<SystemSettingsResponse>(
    "/api/admin/data?resource=system_settings",
    swrPrivateConfig
  );

  const settings = data?.settings;
  const logs = data?.backupLogs ?? [];

  return (
    <StaffShell title="System Settings">
      <div className="mb-6">
        <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-white">
          System <span className="text-accent">Settings</span>
        </h1>
        <p className="mt-1 text-[0.84rem] text-tl">
          Security lockdown status, maintenance mode configuration, and automated backup logs.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-card-glass p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-white/50">Lockdown Mode</span>
            <ShieldAlert className="h-5 w-5 text-danger" />
          </div>
          <div className="text-lg font-bold text-white">
            {isLoading ? "Loading..." : settings?.lockdown_enabled ? "ENABLED" : "Normal"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card-glass p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-white/50">Maintenance Mode</span>
            <Wrench className="h-5 w-5 text-warn" />
          </div>
          <div className="text-lg font-bold text-white">
            {isLoading ? "Loading..." : settings?.maintenance_enabled ? "ACTIVE" : "Operational"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card-glass p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs uppercase text-white/50">Backup Schedule</span>
            <HardDrive className="h-5 w-5 text-accent2" />
          </div>
          <div className="text-lg font-bold capitalize text-white">
            {isLoading ? "Loading..." : settings?.backup_frequency || "Weekly"}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-glass">
        <div className="flex items-center gap-2 border-b border-white/8 px-5 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-accent">
          <Database className="h-4 w-4" /> Recent Backup Logs
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/8 bg-white/4 font-mono text-[0.7rem] uppercase text-white/55">
                <th className="px-4 py-3">File Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-tl">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/4">
                  <td className="px-4 py-3 font-mono">{log.file_name}</td>
                  <td className="px-4 py-3 capitalize">{log.backup_type}</td>
                  <td className="px-4 py-3">{log.scope}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-accent2/30 bg-accent2/15 px-2.5 py-0.5 text-[0.68rem] font-bold text-accent2 uppercase">
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">{log.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </StaffShell>
  );
}
