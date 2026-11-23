"use client";

import { useEffect, useState } from "react";

export interface InventorySnapshotRow {
  id: number;
  book_id: number;
  book_title: string;
  book_author: string;
  category?: string | null;
  shelf_location?: string | null;
  volumes: number;
  available_copies: number;
  damaged_copies: number;
  lost_copies: number;
}

export interface InventoryApiResponse {
  rows: InventorySnapshotRow[];
}

export interface DashboardAlertItem {
  id: string;
  severity: "danger" | "warn" | "info";
  title: string;
  body: string;
  href?: string;
  icon: "lock" | "wifi-off" | "shield" | "out-of-stock" | "damaged" | "lost";
}

/**
 * Short cubic ease-out count-up hook for stat cards.
 * Skips animation immediately when prefers-reduced-motion: reduce is active.
 */
export function useCountUp(target: number | null | undefined, durationMs = 550): number | null {
  const [display, setDisplay] = useState<number | null>(
    typeof target === "number" ? target : null
  );

  useEffect(() => {
    if (typeof target !== "number" || !Number.isFinite(target)) {
      setDisplay(null);
      return;
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setDisplay(target);
      return;
    }

    let rafId = 0;
    const startVal = 0;
    const t0 = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - t0) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startVal + (target - startVal) * eased));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [target, durationMs]);

  return display;
}
