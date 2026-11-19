"use client";

import Link from "next/link";
import { Bell, LogOut, Menu, Settings } from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

interface StaffTopbarProps {
  title: string;
  collapsed: boolean;
  onOpenMobile: () => void;
}

export function StaffTopbar({ title, collapsed, onOpenMobile }: StaffTopbarProps) {
  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-[1050] flex h-[56px] items-center justify-between border-b border-accent/9 bg-topbar/96 px-3.5 backdrop-blur-md transition-[left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:px-6",
        "left-0",
        collapsed ? "lg:left-[64px]" : "lg:left-[240px]"
      )}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/9 bg-white/6 text-white/80 transition hover:bg-white/12 hover:text-white lg:hidden cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
          <img
            src="/static/images/logo.png"
            alt="Logo"
            className="h-7 w-7 rounded-[7px] object-cover"
          />
          <span className="text-[0.88rem] font-bold text-white">Iloilo Library</span>
        </Link>

        <span className="hidden text-[0.88rem] font-semibold tracking-[-0.01em] text-white/60 lg:inline">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LibraryTooltip label="Notifications">
          <Link
            href="/admin/announcements"
            aria-label="Notifications"
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/8 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <Bell className="h-4 w-4" />
          </Link>
        </LibraryTooltip>

        <LibraryTooltip label="System Settings">
          <Link
            href="/system-settings"
            aria-label="System Settings"
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/8 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </LibraryTooltip>

        <LibraryTooltip label="Log Out">
          <a
            href="/logout"
            aria-label="Log Out"
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-danger/20 bg-danger/10 text-danger/80 transition hover:bg-danger/20 hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
          </a>
        </LibraryTooltip>
      </div>
    </header>
  );
}
