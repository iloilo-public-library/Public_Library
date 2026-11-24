"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, LogOut, Menu, Settings } from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface StaffTopbarProps {
  title: string;
  collapsed: boolean;
  onOpenMobile: () => void;
  role?: "admin" | "librarian";
}

export function StaffTopbar({
  title,
  collapsed,
  onOpenMobile,
  role = "admin",
}: StaffTopbarProps) {
  const isLibrarian = role === "librarian";
  const brandHref = isLibrarian ? "/librarian/dashboard" : "/admin/home";
  const brandLabel = isLibrarian ? "Iloilo Library" : "Iloilo City Library";
  const bellHref = isLibrarian ? "/librarian/announcements" : "/admin/account-requests";
  const bellLabel = isLibrarian ? "Notifications" : "Account Requests";
  const settingsHref = isLibrarian ? "/librarian/settings" : "/system-settings";
  const settingsLabel = isLibrarian ? "Librarian Settings" : "System Settings";
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScroll = () => setIsScrolled(window.scrollY > 24);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-[1050] flex h-[56px] items-center justify-between px-3.5 transition-[left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:px-6",
        "left-0",
        collapsed ? "lg:left-[64px]" : "lg:left-[240px]"
      )}
    >
      {/* Base subtle glass tint */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 border-b border-white/8 bg-topbar/45 backdrop-blur-md"
      />
      {/* GPU-composited scroll-blur glass layer */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 border-b border-white/15 bg-topbar/75 shadow-[0_8px_28px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150 transition-opacity duration-300 ease-out will-change-[opacity]",
          isScrolled ? "opacity-100" : "opacity-0"
        )}
      />
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/9 bg-white/6 text-white/80 transition hover:bg-white/12 hover:text-white lg:hidden cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href={brandHref} className="flex items-center gap-2 lg:hidden">
          <img
            src="/images/logo.png"
            alt="Logo"
            className="h-7 w-7 rounded-[7px] object-cover"
          />
          <span className="text-[0.88rem] font-bold text-white">{brandLabel}</span>
        </Link>

        <span className="hidden text-[0.88rem] font-semibold tracking-[-0.01em] text-white/60 lg:inline">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2">

        <LibraryTooltip label={bellLabel}>
          <Link
            href={bellHref}
            aria-label={bellLabel}
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/8 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <Bell className="h-4 w-4" />
          </Link>
        </LibraryTooltip>

        {!isLibrarian && (
          <LibraryTooltip label="Event Calendar">
            <Link
              href="/admin/calendar"
              aria-label="Event Calendar"
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/8 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <CalendarDays className="h-4 w-4" />
            </Link>
          </LibraryTooltip>
        )}

        <LibraryTooltip label={settingsLabel}>
          <Link
            href={settingsHref}
            aria-label={settingsLabel}
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/8 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </LibraryTooltip>

        <LibraryTooltip label={isLibrarian ? "Log Out" : "Logout"}>
          <a
            href="/logout"
            aria-label={isLibrarian ? "Log Out" : "Logout"}
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-danger/20 bg-danger/10 text-danger/80 transition hover:bg-danger/20 hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
          </a>
        </LibraryTooltip>
      </div>
    </header>
  );
}
