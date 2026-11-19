"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Building2,
  Calendar,
  Eye,
  Home,
  Info,
  LayoutGrid,
  Lock,
  LogIn,
  Menu,
  Smartphone,
  User,
  X,
} from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

interface PublicTopbarProps {
  onOpenMemberModal: () => void;
  activePath?: string;
}

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "#offerings", label: "Library Offerings", icon: LayoutGrid },
  { href: "#features", label: "Features", icon: LayoutGrid },
  { href: "#Vission_and_Mission", label: "Vision & Mission", icon: Eye },
  { href: "#services", label: "Services & Resources", icon: Eye },
  { href: "/no_user_about", label: "About Us", icon: Info },
];

export function PublicTopbar({ onOpenMemberModal, activePath = "/" }: PublicTopbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHref, setActiveHref] = useState(activePath);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setIsAndroid(/android/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (activePath !== "/") return;
    const sectionIds = ["offerings", "features", "Vission_and_Mission", "services"];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHref(`#${entry.target.id}`);
          }
        }
      },
      { threshold: 0.3, rootMargin: "-60px 0px -40% 0px" }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    const onScroll = () => {
      if (window.scrollY < 200) setActiveHref("/");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [activePath]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[1100] flex h-[60px] items-center justify-between border-b border-accent/12 bg-bg1/95 px-4 backdrop-blur-md lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-white no-underline">
          <img
            src="/static/images/logo.png"
            alt="Iloilo City Public Library Logo"
            className="h-[34px] w-[34px] shrink-0 rounded-lg object-cover"
          />
          <span className="hidden text-[1.1rem] font-bold tracking-[-0.02em] sm:inline">
            Iloilo City Public Library
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = activeHref === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setActiveHref(href)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[0.88rem] font-medium transition-colors duration-200",
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-white/65 hover:bg-white/8 hover:text-white"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions with shadcn Tooltips */}
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {isAndroid && (
            <LibraryTooltip label="Download for Android">
              <a
                href="/download/apk"
                download="IloiloPublicLibrary.APK"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent2 px-3.5 py-1.5 text-[0.83rem] font-bold text-on-accent transition hover:-translate-y-0.5 hover:bg-[#5dd4a0]"
              >
                <Smartphone className="h-4 w-4" />
                Download
              </a>
            </LibraryTooltip>
          )}

          <LibraryTooltip label="Events Calendar (Members only)">
            <button
              type="button"
              onClick={onOpenMemberModal}
              aria-label="Events Calendar (Members only)"
              className="relative flex items-center justify-center rounded-lg p-2 text-white/40 transition hover:bg-white/8 hover:text-white/75 cursor-pointer"
            >
              <Calendar className="h-[18px] w-[18px]" />
              <Lock className="absolute bottom-1 right-1 h-2.5 w-2.5 text-[#FFD700]" />
            </button>
          </LibraryTooltip>

          <LibraryTooltip label="Notifications (Members only)">
            <button
              type="button"
              onClick={onOpenMemberModal}
              aria-label="Notifications (Members only)"
              className="relative flex items-center justify-center rounded-lg p-2 text-white/40 transition hover:bg-white/8 hover:text-white/75 cursor-pointer"
            >
              <Bell className="h-[18px] w-[18px]" />
              <Lock className="absolute bottom-1 right-1 h-2.5 w-2.5 text-[#FFD700]" />
            </button>
          </LibraryTooltip>

          <LibraryTooltip label="Profile (Members only)">
            <button
              type="button"
              onClick={onOpenMemberModal}
              aria-label="Profile (Members only)"
              className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-white/15 bg-accent/15 text-white/40 transition hover:border-accent/40 hover:text-white/75 cursor-pointer"
            >
              <User className="h-4 w-4" />
              <Lock className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-bg1 p-0.5 text-[#FFD700]" />
            </button>
          </LibraryTooltip>

          <Link
            href="/login"
            className="hidden items-center gap-1.5 rounded-full bg-accent px-[18px] py-[7px] text-[0.83rem] font-bold text-on-accent transition hover:-translate-y-0.5 hover:bg-[#b8d4ec] lg:inline-flex"
          >
            <LogIn className="h-4 w-4" />
            Login
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex items-center justify-center rounded-lg p-1.5 text-white transition hover:bg-white/8 lg:hidden cursor-pointer"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Mobile Slide-In Drawer */}
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
              transition={{ type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="fixed inset-y-0 left-0 z-[1200] flex w-[min(280px,85vw)] flex-col overflow-y-auto border-r border-accent/10 bg-[#162432]/99 pb-6 shadow-[8px_0_32px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:hidden"
            >
              <div className="mb-2 flex h-[60px] shrink-0 items-center justify-between border-b border-accent/10 bg-accent/4 px-3.5">
                <span className="flex items-center gap-1.5 text-[0.85rem] font-bold text-accent">
                  <Building2 className="h-4 w-4" />
                  Library
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-white/10 bg-white/7 text-white/70 transition hover:bg-white/14 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-0.5 px-2">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const isActive = activeHref === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => {
                        setActiveHref(href);
                        setMobileOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[10px] px-4 py-3 text-[0.95rem] font-medium transition",
                        isActive
                          ? "bg-accent/15 text-accent"
                          : "text-white/75 hover:bg-accent/10 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="mt-3 flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-on-accent transition hover:bg-[#b8d4ec]"
                >
                  <LogIn className="h-4 w-4" />
                  Login
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
