"use client";

import Link from "next/link";
import { AlertTriangle, ListOrdered, RefreshCw } from "lucide-react";
import type { InventorySnapshotRow } from "./types";

interface BookAvailabilityTableCardProps {
  rows: InventorySnapshotRow[];
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  viewAllHref?: string;
}

export function BookAvailabilityTableCard({
  rows,
  isLoading,
  hasError,
  onRetry,
  viewAllHref = "/admin/books",
}: BookAvailabilityTableCardProps) {
  const topTen = [...rows]
    .sort((a, b) => (b.volumes || 0) - (a.volumes || 0))
    .slice(0, 10);

  return (
    <div className="dash-chart-card lg:col-span-2">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <h2
          className="flex items-center gap-2 text-[0.76rem] font-bold uppercase tracking-[0.07em]"
          style={{ color: "var(--dash-text-primary)" }}
        >
          <span
            className="flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-[7px]"
            style={{
              backgroundColor: "rgba(91, 155, 213, 0.15)",
              color: "var(--c-blue)",
            }}
          >
            <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          Book Availability Snapshot
        </h2>

        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[0.64rem] font-bold"
            style={{
              backgroundColor: "rgba(91, 155, 213, 0.13)",
              color: "var(--c-blue)",
              border: "1px solid rgba(91, 155, 213, 0.24)",
            }}
          >
            Top 10 by stock
          </span>
          <Link
            href={viewAllHref}
            className="inline-flex min-h-[36px] items-center rounded-full px-3 py-1 text-[0.72rem] font-semibold transition hover:underline"
            style={{ color: "var(--accent)" }}
          >
            View all
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 py-3">
          {[1, 2, 3, 4, 5].map((k) => (
            <div
              key={k}
              className="h-9 w-full animate-pulse rounded-lg"
              style={{ backgroundColor: "var(--dash-track-bg)" }}
            />
          ))}
        </div>
      ) : hasError ? (
        <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center">
          <AlertTriangle className="h-6 w-6" style={{ color: "var(--c-red)" }} aria-hidden="true" />
          <p className="text-xs font-semibold" style={{ color: "var(--c-red)" }}>
            Failed to load inventory
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold cursor-pointer"
            style={{
              backgroundColor: "var(--dash-inner-bg)",
              border: "1px solid var(--dash-border)",
              color: "var(--dash-text-primary)",
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : topTen.length === 0 ? (
        <div
          className="py-10 text-center text-xs"
          style={{ color: "var(--dash-text-muted)" }}
        >
          No book inventory records found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr
                className="text-left text-[0.63rem] font-bold uppercase tracking-[0.07em]"
                style={{
                  color: "var(--dash-text-faint)",
                  borderBottom: "1px solid var(--dash-border)",
                }}
              >
                <th scope="col" className="px-2 pb-2">#</th>
                <th scope="col" className="px-2 pb-2">Title</th>
                <th scope="col" className="px-2 pb-2">Author</th>
                <th scope="col" className="px-2 pb-2">Category</th>
                <th scope="col" className="px-2 pb-2 text-center">Total</th>
                <th scope="col" className="px-2 pb-2 text-center">Available</th>
                <th scope="col" className="px-2 pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {topTen.map((b, i) => {
                const avail = b.available_copies || 0;
                const total = b.volumes || 0;
                const statusInfo =
                  avail === 0
                    ? {
                        label: "Out of Stock",
                        bg: "rgba(224, 84, 84, 0.15)",
                        color: "var(--c-red)",
                      }
                    : avail <= 2
                    ? {
                        label: "Low Stock",
                        bg: "rgba(245, 166, 35, 0.15)",
                        color: "var(--c-orange)",
                      }
                    : {
                        label: "In Stock",
                        bg: "rgba(45, 212, 191, 0.15)",
                        color: "var(--c-teal)",
                      };

                return (
                  <tr
                    key={b.id}
                    className="transition-colors hover:bg-white/[0.03]"
                    style={{ borderBottom: "1px solid var(--dash-border-subtle)" }}
                  >
                    <td
                      className="dash-tabular px-2 py-2.5 text-[0.7rem]"
                      style={{ color: "var(--dash-text-faint)" }}
                    >
                      {i + 1}
                    </td>
                    <td
                      className="max-w-[200px] truncate px-2 py-2.5 text-[0.78rem] font-medium"
                      style={{ color: "var(--dash-text-primary)" }}
                      title={b.book_title || ""}
                    >
                      {b.book_title || "—"}
                    </td>
                    <td
                      className="max-w-[150px] truncate px-2 py-2.5 text-[0.75rem]"
                      style={{ color: "var(--dash-text-muted)" }}
                      title={b.book_author || ""}
                    >
                      {b.book_author || "—"}
                    </td>
                    <td
                      className="px-2 py-2.5 text-[0.72rem]"
                      style={{ color: "var(--dash-text-muted)" }}
                    >
                      {b.category || b.shelf_location || "—"}
                    </td>
                    <td
                      className="dash-tabular px-2 py-2.5 text-center text-[0.78rem] font-semibold"
                      style={{ color: "var(--dash-text-primary)" }}
                    >
                      {total.toLocaleString()}
                    </td>
                    <td
                      className="dash-tabular px-2 py-2.5 text-center text-[0.78rem] font-bold"
                      style={{ color: statusInfo.color }}
                    >
                      {avail.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-bold"
                        style={{
                          backgroundColor: statusInfo.bg,
                          color: statusInfo.color,
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
