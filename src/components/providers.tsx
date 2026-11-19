"use client";

import * as React from "react";
import { domAnimation, LazyMotion, MotionConfig } from "framer-motion";
import { SWRConfig } from "swr";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiFetcher } from "@/lib/api";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LazyMotion features={domAnimation}>
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
      </LazyMotion>
    </ThemeProvider>
  );
}
