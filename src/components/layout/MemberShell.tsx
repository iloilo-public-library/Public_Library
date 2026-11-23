"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Building2,
  CalendarDays,
  LogOut,
  Menu,
  User,
  X,
} from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const MEMBER_NAV = [
  { href: "/user/home", label: "Home" },
  { href: "/user/browse", label: "Browse Books" },
  { href: "/user/borrowed", label: "Borrowed" },
  { href: "/user/borrow-history", label: "History" },
  { href: "/user/event", label: "Events" },
  { href: "/user/about", label: "About Us" },
];

export function MemberShell({
  children,
  fullBleed = false,
}: {
  children: ReactNode;
  fullBleed?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSettingsActive = pathname === "/user/settings" || pathname === "/user/edit_profile";

  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-[1100] flex h-[60px] items-center justify-between border-b border-accent/12 bg-bg1/95 px-4 backdrop-blur-md lg:px-10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open member menu"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-white/80 transition hover:bg-white/8 hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/user/home" className="flex shrink-0 items-center gap-2.5 text-white">
            <img
              src="/images/logo.png"
              alt="Iloilo City Public Library Logo"
              className="h-[34px] w-[34px] rounded-lg object-cover"
            />
            <span className="hidden text-[1.05rem] font-bold tracking-[-0.02em] sm:inline">
              Iloilo City Public Library
            </span>
          </Link>
        </div>

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
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition",
                pathname === "/user/event"
                  ? "bg-accent/15 text-accent"
                  : "text-white/70 hover:bg-white/8 hover:text-accent"
              )}
            >
              <CalendarDays className="h-[18px] w-[18px]" />
            </Link>
          </LibraryTooltip>
          <LibraryTooltip label="Notifications">
            <Link
              href="/user/notifications"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition",
                pathname === "/user/notifications"
                  ? "bg-accent/15 text-accent"
                  : "text-white/70 hover:bg-white/8 hover:text-accent"
              )}
            >
              <Bell className="h-[18px] w-[18px]" />
            </Link>
          </LibraryTooltip>
          <LibraryTooltip label="Account & Settings">
            <Link
              href="/user/settings"
              className={cn(
                "flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 transition",
                isSettingsActive
                  ? "border-accent bg-accent text-on-accent"
                  : "border-accent/35 bg-accent/15 text-accent hover:border-accent"
              )}
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

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[1190] bg-black/60 backdrop-blur-[3px] lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-[1200] flex w-[min(280px,85vw)] flex-col overflow-y-auto border-r border-accent/10 bg-[#162432]/99 pb-6 shadow-[8px_0_32px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:hidden"
            >
              <div className="mb-2 flex h-[60px] shrink-0 items-center justify-between border-b border-accent/10 bg-accent/4 px-3.5">
                <span className="flex items-center gap-1.5 text-[0.85rem] font-bold text-accent">
                  <Building2 className="h-4 w-4" />
                  Member Portal
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[9px] border border-white/10 bg-white/7 text-white/70 transition hover:bg-white/14 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-0.5 px-2">
                {MEMBER_NAV.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "rounded-[10px] px-4 py-3 text-[0.92rem] font-medium transition",
                        isActive
                          ? "bg-accent/15 text-accent"
                          : "text-white/75 hover:bg-accent/10 hover:text-white"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <Link
                  href="/user/settings"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-[10px] px-4 py-3 text-[0.92rem] font-medium transition",
                    isSettingsActive
                      ? "bg-accent/15 text-accent"
                      : "text-white/75 hover:bg-accent/10 hover:text-white"
                  )}
                >
                  Account &amp; Settings
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {fullBleed ? (
        children
      ) : (
        <main className="mx-auto max-w-[1360px] px-4 pb-16 pt-[84px] md:px-10">{children}</main>
      )}
    </div>
  );
}
