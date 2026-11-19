"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, Compass, LogOut, User } from "lucide-react";
import { BookHero } from "@/components/landing/BookHero";
import { OfferingsSection } from "@/components/landing/OfferingsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { VisionMissionSection } from "@/components/landing/VisionMissionSection";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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

      <BookHero
        eyebrow="Member Portal · Iloilo City Public Library"
        headlineTop="Welcome Back to the"
        headlineAccent="Heart of Knowledge"
        description="Explore our full catalog, track your borrowed books, and discover community events at the Dr. Graciano Lopez Jaena Learning Resource Center."
        primaryCta={{ href: "/user/browse", label: "Explore Books" }}
        secondaryCta={{
          href: "/user/borrowed",
          label: "My Borrowed Books",
          icon: <Compass className="h-4 w-4" />,
        }}
      />

      <OfferingsSection catalogHref="/user/browse" />
      <FeaturesSection mode="member" />
      <VisionMissionSection />
      <ServicesSection />

      <PublicFooter onOpenLegal={setLegalModal} />
      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
