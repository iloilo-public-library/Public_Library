"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Compass,
  LogOut,
  Move,
  User,
} from "lucide-react";
import { OfferingsSection } from "@/components/landing/OfferingsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { VisionMissionSection } from "@/components/landing/VisionMissionSection";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const Hero3DCanvas = dynamic(
  () => import("@/components/landing/Hero3DCanvas").then((mod) => mod.Hero3DCanvas),
  { ssr: false }
);

const HERO_EASE = [0.22, 0.68, 0, 1] as const;

export default function UserHomePage() {
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  return (
    <div className="min-h-screen">
      {/* Member Topbar */}
      <header className="fixed inset-x-0 top-0 z-[1100] flex h-[60px] items-center justify-between border-b border-accent/12 bg-bg1/95 px-4 backdrop-blur-md lg:px-10">
        <Link href="/user/home" className="flex shrink-0 items-center gap-2.5 text-white">
          <img
            src="/static/images/logo.png"
            alt="Logo"
            className="h-[34px] w-[34px] rounded-lg object-cover"
          />
          <span className="hidden text-[1.1rem] font-bold tracking-[-0.02em] sm:inline">
            Iloilo City Public Library
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <Link
            href="/user/home"
            className="rounded-lg bg-accent/15 px-3 py-1.5 text-[0.88rem] font-medium text-accent"
          >
            Home
          </Link>
          <Link
            href="/user/browse"
            className="rounded-lg px-3 py-1.5 text-[0.88rem] font-medium text-white/65 transition hover:bg-white/8 hover:text-white"
          >
            Browse Books
          </Link>
          <Link
            href="/user/borrowed"
            className="rounded-lg px-3 py-1.5 text-[0.88rem] font-medium text-white/65 transition hover:bg-white/8 hover:text-white"
          >
            Borrowed
          </Link>
          <Link
            href="/user/event"
            className="rounded-lg px-3 py-1.5 text-[0.88rem] font-medium text-white/65 transition hover:bg-white/8 hover:text-white"
          >
            Events
          </Link>
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
          <LibraryTooltip label="Profile & Settings">
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

      {/* ══ 3D HERO SECTION ══ */}
      <section className="hero-preserve-dark relative flex min-h-screen items-center overflow-hidden pt-[60px]">
        <Hero3DCanvas />
        <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_60%_70%_at_30%_50%,transparent_30%,rgba(20,32,44,0.6)_100%),linear-gradient(to_right,rgba(20,32,44,0.55)_0%,transparent_55%)]" />

        <div className="pointer-events-none relative z-[3] max-w-[600px] px-6 md:px-[60px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease: HERO_EASE }}
            className="mb-[22px] inline-flex items-center gap-2 rounded-full border border-accent/22 bg-accent/12 px-3.5 py-1 text-[0.75rem] font-bold uppercase tracking-[0.07em] text-accent"
          >
            <Building2 className="h-3.5 w-3.5" />
            Member Portal · Iloilo City Public Library
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.14, ease: HERO_EASE }}
            className="mb-4 text-[clamp(2rem,4.5vw,3.2rem)] font-bold leading-[1.12] tracking-[-0.03em] text-white"
          >
            Welcome Back to the
            <br />
            <span className="text-accent">Heart of Knowledge</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.22, ease: HERO_EASE }}
            className="mb-8 max-w-[440px] text-[1rem] leading-[1.7] text-tl"
          >
            Explore our full catalog, track your borrowed books, and discover community events at
            the Dr. Graciano Lopez Jaena Learning Resource Center.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3, ease: HERO_EASE }}
            className="pointer-events-auto flex flex-wrap gap-3"
          >
            <Link
              href="/user/browse"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-[0.92rem] font-bold text-on-accent transition hover:-translate-y-0.5 hover:bg-[#b8d4ec]"
            >
              <BookOpen className="h-4 w-4" /> Explore Books
            </Link>
            <Link
              href="/user/borrowed"
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-transparent px-[22px] py-[11px] text-[0.92rem] font-semibold text-white transition hover:border-white/50 hover:bg-white/8"
            >
              <Compass className="h-4 w-4" /> My Borrowed Books
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.38, ease: HERO_EASE }}
          className="pointer-events-none absolute bottom-4 right-4 z-[4] inline-flex items-center gap-2 rounded-full border border-accent/18 bg-bg1/70 px-3.5 py-1.5 text-[0.72rem] font-semibold tracking-[0.03em] text-accent/70 backdrop-blur-md md:bottom-7 md:right-10"
        >
          <Move className="h-3.5 w-3.5" /> Drag to orbit &nbsp;·&nbsp; Scroll to zoom
        </motion.div>
      </section>

      <OfferingsSection catalogHref="/user/browse" />
      <FeaturesSection mode="member" />
      <VisionMissionSection />
      <ServicesSection />

      <PublicFooter onOpenLegal={setLegalModal} />
      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
