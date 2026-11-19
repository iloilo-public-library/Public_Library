"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AlertCircle, Database, RefreshCw, Search, X } from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { Button } from "@/components/ui/button";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { swrPrivateConfig } from "@/lib/api";

export interface ColumnDef {
  key: string;
  label: string;
  mono?: boolean;
}

interface AdminResourceViewProps {
  title: string;
  accentWord: string;
  subtitle: string;
  resource: string;
  columns: ColumnDef[];
}

export function AdminResourceView({
  title,
  accentWord,
  subtitle,
  resource,
  columns,
}: AdminResourceViewProps) {
  const [search, setSearch] = useState("");
  const { data, error, isLoading, mutate } = useSWR<{ rows?: Record<string, unknown>[] }>(
    `/api/admin/data?resource=${encodeURIComponent(resource)}`,
    swrPrivateConfig
  );

  const rows = data?.rows ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [rows, search]);

  const formatCell = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") {
      return (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${
            value
              ? "border border-accent2/30 bg-accent2/15 text-accent2"
              : "border border-white/12 bg-white/6 text-white/55"
          }`}
        >
          {value ? "Yes" : "No"}
        </span>
      );
    }
    const str = String(value);
    if (str.startsWith("gAAAAAB")) {
      return (
        <LibraryTooltip label="Fernet encrypted ciphertext stored at rest">
          <span className="inline-flex rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-[0.7rem] text-accent">
            [Encrypted]
          </span>
        </LibraryTooltip>
      );
    }
    return str.length > 64 ? `${str.slice(0, 64)}…` : str;
  };

  return (
    <StaffShell title={`${title} ${accentWord}`.trim()}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-white">
            {title} <span className="text-accent">{accentWord}</span>
          </h1>
          <p className="mt-1 text-[0.84rem] text-tl">{subtitle}</p>
        </div>

        <LibraryTooltip label="Refresh from Supabase">
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </LibraryTooltip>
      </div>

      {/* Search Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-card-glass p-3.5 backdrop-blur-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Filter ${rows.length} record(s)...`}
            className="w-full rounded-xl border border-white/10 bg-bg1/75 py-2 pl-9 pr-9 text-sm text-white placeholder:text-white/38 focus:border-accent/50 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear filter"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="font-mono text-xs text-tl/70">
          Showing {filtered.length} / {rows.length}
        </span>
      </div>

      {/* Error / Loading / Table */}
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/25 bg-danger/10 p-5 text-sm text-danger">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error.message || "Unable to load records from Supabase."}</span>
          </div>
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
          <Database className="mx-auto mb-3 h-9 w-9 text-accent/45" />
          <h3 className="text-sm font-bold text-white">No records found</h3>
          <p className="mt-1 text-xs text-tl/70">
            This Supabase table currently has no matching entries.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-glass backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/4 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-accent">
                  {columns.map((col) => (
                    <th key={col.key} className="px-4 py-3 font-semibold whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {filtered.map((row, idx) => (
                  <tr
                    key={String(row.id ?? idx)}
                    className="transition-colors hover:bg-white/5"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-tl ${col.mono ? "font-mono text-[0.75rem]" : ""}`}
                      >
                        {formatCell(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
