"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Smartphone, X } from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PublicTopbarProps {
  onOpenMemberModal?: () => void;
  activePath?: string;
}

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "#offerings", label: "Library Offerings" },
  { href: "#features", label: "Features" },
  { href: "#Vission_and_Mission", label: "Vision & Mission" },
  { href: "#services", label: "Services & Resources" },
  { href: "/no_user_about", label: "About Us" },
];

const SECTION_HASHES = new Set([
  "#offerings",
  "#features",
  "#Vission_and_Mission",
  "#services",
]);

export function PublicTopbar({
  onOpenMemberModal: _onOpenMemberModal,
  activePath = "/",
}: PublicTopbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHref, setActiveHref] = useState(activePath);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollLockUntilRef = useRef<number>(0);

  const handleNavClick = (href: string, closeMobile = false) => {
    scrollLockUntilRef.current = Date.now() + 850;
    setActiveHref(href);
    if (closeMobile) {
      setMobileOpen(false);
    }
  };

  useEffect(() => {
    setIsAndroid(/android/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (activePath !== "/") return;
    const currentHash = window.location.hash;
    if (!SECTION_HASHES.has(currentHash)) return;

    scrollLockUntilRef.current = Date.now() + 1000;
    setActiveHref(currentHash);

    const scrollToTarget = () => {
      const el = document.getElementById(currentHash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const rafId = window.requestAnimationFrame(scrollToTarget);
    const timerId = window.setTimeout(scrollToTarget, 150);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [activePath]);

  useEffect(() => {
    const updateScroll = () => {
      setIsScrolled(window.scrollY > 24);
      if (
        activePath === "/" &&
        window.scrollY < 200 &&
        Date.now() >= scrollLockUntilRef.current
      ) {
        setActiveHref("/");
      }
    };

    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, [activePath]);

  useEffect(() => {
    if (activePath !== "/") return;
    const sectionIds = ["offerings", "features", "Vission_and_Mission", "services"];
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < scrollLockUntilRef.current) return;
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

    return () => {
      observer.disconnect();
    };
  }, [activePath]);

  return (
    <>
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

        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-white no-underline">
          <img
            src="/images/logo.png"
            alt="Iloilo City Public Library Logo"
            className="h-[34px] w-[34px] shrink-0 rounded-lg object-cover"
          />
          <span className="hidden text-[1.1rem] font-bold tracking-[-0.02em] sm:inline">
            Iloilo City Public Library
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = activeHref === href;
            const resolvedHref =
              href.startsWith("#") && activePath !== "/" ? `/${href}` : href;
            return (
              <Link
                key={href}
                href={resolvedHref}
                onClick={() => handleNavClick(href)}
                className={cn(
                  "relative z-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.875rem] font-medium transition-colors duration-200",
                  isActive ? "text-accent" : "text-white/70 hover:text-white"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="public-topbar-active-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 36, mass: 0.8 }}
                    className="absolute inset-0 -z-10 rounded-full border border-accent/25 bg-accent/18 shadow-[0_0_16px_rgba(159,193,225,0.18)]"
                  />
                )}
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex shrink-0 items-center gap-2.5">
          {isAndroid && (
            <LibraryTooltip label="Download for Android">
              <a
                href="/download/apk"
                download="IloiloPublicLibrary.APK"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent2 px-3.5 py-1.5 text-[0.83rem] font-bold text-on-accent transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#5dd4a0]"
              >
                <Smartphone className="h-4 w-4" />
                Download
              </a>
            </LibraryTooltip>
          )}

          <Link
            href="/login"
            className="hidden items-center justify-center rounded-full border border-accent/30 bg-accent/90 px-5 py-1.5 text-[0.85rem] font-semibold text-on-accent shadow-[0_4px_16px_rgba(159,193,225,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:shadow-[0_6px_22px_rgba(159,193,225,0.35)] lg:inline-flex"
          >
            Login
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5 text-white transition-colors duration-200 hover:bg-white/12 lg:hidden cursor-pointer"
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
              transition={{ duration: 0.25 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[1190] bg-black/55 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="fixed inset-y-0 left-0 z-[1200] flex w-[min(280px,85vw)] flex-col overflow-y-auto border-r border-white/15 bg-bg1/80 pb-6 shadow-[8px_0_32px_rgba(0,0,0,0.55)] backdrop-blur-2xl backdrop-saturate-150 lg:hidden"
            >
              <div className="mb-2 flex h-[64px] shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.04] px-4">
                <span className="text-[0.9rem] font-bold tracking-tight text-accent">
                  Menu
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-white/10 bg-white/7 text-white/70 transition-colors duration-200 hover:bg-white/14 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-1 px-2.5">
                {NAV_ITEMS.map(({ href, label }) => {
                  const isActive = activeHref === href;
                  const resolvedHref =
                    href.startsWith("#") && activePath !== "/" ? `/${href}` : href;
                  return (
                    <Link
                      key={href}
                      href={resolvedHref}
                      onClick={() => handleNavClick(href, true)}
                      className={cn(
                        "flex items-center rounded-xl px-4 py-3 text-[0.95rem] font-medium transition-colors duration-200",
                        isActive
                          ? "border border-accent/25 bg-accent/15 text-accent"
                          : "text-white/75 hover:bg-white/8 hover:text-white"
                      )}
                    >
                      {label}
                    </Link>
                  );
                })}
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="mt-4 flex items-center justify-center rounded-full border border-accent/30 bg-accent/90 px-4 py-2.5 text-sm font-bold text-on-accent shadow-[0_4px_16px_rgba(159,193,225,0.2)] transition-colors duration-200 hover:bg-accent"
                >
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
