"use client";

import type { ComponentPropsWithoutRef } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogPortal = RadixDialog.Portal;
export const DialogClose = RadixDialog.Close;
export const DialogTitle = RadixDialog.Title;
export const DialogDescription = RadixDialog.Description;

export function DialogOverlay({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixDialog.Overlay>) {
  return (
    <RadixDialog.Overlay
      className={cn(
        "fixed inset-0 z-[2000] bg-black/72 backdrop-blur-[6px]",
        className
      )}
      {...rest}
    />
  );
}

export function DialogContent({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RadixDialog.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[2010] w-[calc(100%-2.5rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[22px] border border-accent/20 bg-modal text-white shadow-[0_24px_72px_rgba(0,0,0,0.6)] outline-none",
          className
        )}
        {...rest}
      >
        {children}
      </RadixDialog.Content>
    </DialogPortal>
  );
}
