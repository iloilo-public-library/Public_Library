"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = RadixTooltip.Provider;
export const Tooltip = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixTooltip.Content>) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={sideOffset}
        className={cn(
          "z-[2500] rounded-lg border border-accent/20 bg-tooltip-bg px-2.5 py-1.5 text-xs font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md",
          className
        )}
        {...rest}
      />
    </RadixTooltip.Portal>
  );
}

export function LibraryTooltip({
  label,
  children,
  side = "bottom",
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
