"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, LogOut, Settings, User } from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const MEMBER_NAV = [
  { href: "/user/home", label: "Home" },
  { href: "/user/browse", label: "Browse Books" },
  { href: "/user/borrowed", label: "Borrowed" },
  { href: "/user/borrow-history", label: "History" },
  { href: "/user/event", label: "Events" },
];

export function MemberShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-[1100] flex h-[60px] items-center justify-between border-b border-accent/12 bg-bg1/95 px-4 backdrop-blur-md lg:px-10">
        <Link href="/user/home" className="flex shrink-0 items-center gap-2.5 text-white">
          <img
            src="/images/logo.png"
            alt="Logo"
            className="h-[34px] w-[34px] rounded-lg object-cover"
          />
          <span className="hidden text-[1.05rem] font-bold tracking-[-0.02em] sm:inline">
            Iloilo City Public Library
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {MEMBER_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[0.86rem] font-medium transition",
                pathname === item.href
                  ? "bg-accent/15 text-accent"
                  : "text-white/65 hover:bg-white/8 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LibraryTooltip label="Events Calendar">
            <Link
              href="/user/event"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/8 hover:text-accent"
            >
              <CalendarDays className="h-[18px] w-[18px]" />
            </Link>
          </LibraryTooltip>
          <LibraryTooltip label="Notifications">
            <Link
              href="/user/notifications"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/8 hover:text-accent"
            >
              <Bell className="h-[18px] w-[18px]" />
            </Link>
          </LibraryTooltip>
          <LibraryTooltip label="Settings">
            <Link
              href="/user/settings"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/8 hover:text-accent"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
          </LibraryTooltip>
          <LibraryTooltip label="Profile">
            <Link
              href="/user/edit_profile"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-accent/35 bg-accent/15 text-accent transition hover:border-accent"
            >
              <User className="h-4 w-4" />
            </Link>
          </LibraryTooltip>
          <LibraryTooltip label="Log Out">
            <a
              href="/logout"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-danger/20 bg-danger/10 text-danger/85 transition hover:bg-danger/20 hover:text-danger"
            >
              <LogOut className="h-4 w-4" />
            </a>
          </LibraryTooltip>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-4 pb-16 pt-[84px] md:px-10">{children}</main>
    </div>
  );
}
