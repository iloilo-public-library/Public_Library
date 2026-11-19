"use client";

import * as React from "react";
import { MotionConfig } from "framer-motion";
import { SWRConfig } from "swr";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiFetcher } from "@/lib/api";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SWRConfig
        value={{
          fetcher: apiFetcher,
          revalidateOnFocus: false,
          dedupingInterval: 15_000,
          shouldRetryOnError: false,
        }}
      >
        <TooltipProvider delayDuration={180} skipDelayDuration={120}>
          {children}
        </TooltipProvider>
      </SWRConfig>
    </MotionConfig>
  );
}
