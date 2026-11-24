"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  LogOut,
  Megaphone,
  Menu,
  Pin,
  User,
  X,
  Zap,
} from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { apiMutate, swrPrivateConfig } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ShellNotification {
  id: number;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  author: string;
  created_at: string;
  is_read: boolean;
}

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

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
  const [notifOpen, setNotifOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const isSettingsActive = pathname === "/user/settings" || pathname === "/user/edit_profile";

  const { data: notifData, mutate: mutateNotif } = useSWR<{
    ok?: boolean;
    notifications?: ShellNotification[];
    unreadCount?: number;
  }>("/api/user/notifications", swrPrivateConfig);

  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  const handleMarkNotif = async (action: "read" | "read_all", announcementId?: number) => {
    await apiMutate("/api/user/notifications", {
      method: "PUT",
      body: action === "read_all" ? { action } : { action, announcement_id: announcementId },
    });
    await mutateNotif();
  };

  useEffect(() => {
    const updateScroll = () => setIsScrolled(window.scrollY > 24);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-[1100] flex h-[64px] items-center justify-between px-4 lg:px-10">
        {/* Base frosted glass header layer */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 border-b border-white/10 bg-topbar/88 backdrop-blur-xl"
        />
        {/* GPU-composited deeper glass layer fading on scroll */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 border-b border-white/15 bg-topbar/96 shadow-[0_8px_28px_rgba(0,0,0,0.2)] backdrop-blur-2xl backdrop-saturate-150 transition-opacity duration-300 ease-out will-change-[opacity]",
            isScrolled ? "opacity-100" : "opacity-0"
          )}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open member menu"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80 transition-colors duration-200 hover:bg-white/12 hover:text-white lg:hidden"
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
          {MEMBER_NAV.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative z-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.875rem] font-medium transition-colors duration-200",
                  isActive ? "text-accent" : "text-white/70 hover:text-white"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="member-topbar-active-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 36, mass: 0.8 }}
                    className="absolute inset-0 -z-10 rounded-full border border-accent/25 bg-accent/18 shadow-[0_0_16px_rgba(159,193,225,0.18)]"
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label="Open notifications feed"
              className={cn(
                "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition",
                notifOpen || pathname === "/user/notifications"
                  ? "bg-accent/15 text-accent"
                  : "text-white/70 hover:bg-white/8 hover:text-accent"
              )}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 font-mono text-[0.6rem] font-bold text-white shadow">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
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

      {/* Right-Side Notifications Slide-Over Drawer */}
      <AnimatePresence>
        {notifOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotifOpen(false)}
              className="fixed inset-0 z-[1190] bg-black/55 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              aria-label="Notifications Feed"
              className="fixed inset-y-0 right-0 z-[1200] flex w-[min(420px,92vw)] flex-col border-l border-white/12 bg-[#0d1622]/96 shadow-[-12px_0_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
            >
              {/* Drawer Header */}
              <div className="flex shrink-0 items-start justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-warn/30 bg-warn/15 text-warn">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-[0.95rem] font-bold tracking-tight text-white">
                      Notifications Feed
                    </h2>
                    <p className="text-[0.73rem] text-tl/65">
                      Real-time library bulletins &amp; updates
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMarkNotif("read_all")}
                      title="Mark all read"
                      className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-accent2/30 bg-accent2/12 px-2.5 text-[0.7rem] font-semibold text-accent2 transition hover:bg-accent2/20"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Mark all
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    aria-label="Close notifications drawer"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/12 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Feed Items */}
              <div className="flex-1 divide-y divide-white/8 overflow-y-auto px-5 py-2">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <Bell className="mb-2.5 h-8 w-8 text-accent/45" />
                    <p className="text-xs font-semibold text-white">You&apos;re all caught up!</p>
                    <p className="mt-1 text-[0.72rem] text-tl/60">
                      No new notices or bulletins right now.
                    </p>
                  </div>
                ) : (
                  notifications.slice(0, 12).map((item) => {
                    const cat = (item.category || "general").toLowerCase();
                    const isUrgent = cat === "urgent";
                    const isEvent = cat === "event";
                    const iconColor = isUrgent
                      ? "text-danger"
                      : isEvent
                        ? "text-gold"
                        : "text-warn";
                    const catTextColor = isUrgent
                      ? "text-danger"
                      : isEvent
                        ? "text-gold"
                        : "text-accent";
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "-mx-2 rounded-lg px-2 py-4 transition hover:bg-white/[0.02]",
                          item.is_read ? "opacity-75" : ""
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-start gap-2.5">
                            <span className={`mt-0.5 shrink-0 ${iconColor}`}>
                              {isUrgent ? (
                                <AlertTriangle className="h-4 w-4" />
                              ) : isEvent ? (
                                <CalendarDays className="h-4 w-4" />
                              ) : (
                                <Megaphone className="h-4 w-4" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {!item.is_read && (
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                                )}
                                {item.pinned && (
                                  <Pin className="h-3 w-3 shrink-0 text-gold" />
                                )}
                                <span className="break-words text-[0.84rem] font-bold text-white">
                                  {item.title}
                                </span>
                              </div>
                              <div
                                className={`mt-0.5 text-[0.7rem] font-semibold tracking-[0.03em] ${catTextColor}`}
                              >
                                <span className="uppercase">{item.category}</span>
                                <span className="font-normal text-tl/65">
                                  {" "}
                                  by <strong className="text-white/85">{item.author || "Library Staff"}</strong>
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 whitespace-nowrap font-mono text-[0.68rem] text-white/45">
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </div>

                        {item.body && (
                          <p className="mt-2 whitespace-pre-line break-words pl-6 text-[0.78rem] leading-relaxed text-tl/80">
                            {item.body}
                          </p>
                        )}

                        {!item.is_read && (
                          <div className="mt-2.5 flex justify-end pl-6">
                            <button
                              type="button"
                              onClick={() => handleMarkNotif("read", item.id)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-accent2/30 bg-accent2/10 px-2.5 py-1 text-[0.68rem] font-semibold text-accent2 transition hover:bg-accent2/20"
                            >
                              <Check className="h-3 w-3" /> Mark read
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Sticky Drawer Footer */}
              <div className="shrink-0 border-t border-white/10 bg-bg1/80 px-5 py-3.5 text-center">
                <Link
                  href="/user/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold transition hover:underline"
                >
                  View Full Notifications &rarr;
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {fullBleed ? (
        children
      ) : (
        <main className="mx-auto max-w-[1360px] px-4 pb-16 pt-[88px] md:px-10">{children}</main>
      )}
    </div>
  );
}
