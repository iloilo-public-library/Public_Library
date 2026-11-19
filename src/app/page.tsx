"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookmarkCheck,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  Compass,
  Eye,
  Lock,
  Move,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { PublicTopbar } from "@/components/landing/PublicTopbar";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { OfferingsSection } from "@/components/landing/OfferingsSection";
import { MembershipModal } from "@/components/landing/MembershipModal";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { LibraryTooltip } from "@/components/ui/tooltip";

const Hero3DCanvas = dynamic(
  () => import("@/components/landing/Hero3DCanvas").then((mod) => mod.Hero3DCanvas),
  { ssr: false }
);

const FEATURES = [
  {
    icon: Search,
    title: "Book Catalog & Search",
    locked: false,
    desc: "Browse thousands of titles across all categories — from Philippine literature to science, technology, and more.",
  },
  {
    icon: BookmarkCheck,
    title: "Book Borrowing",
    locked: true,
    desc: "Check out books for home reading. Track your borrowed titles and due dates from your member profile.",
  },
  {
    icon: Building2,
    title: "Local History Archive",
    locked: true,
    desc: "Explore Iloilo's rich heritage through curated documents, photographs, and rare historical texts.",
  },
  {
    icon: CalendarDays,
    title: "Events & Programs",
    locked: true,
    desc: "Join storytelling sessions, author talks, literacy workshops, and community events throughout the year.",
  },
];

const HERO_EASE = [0.22, 0.68, 0, 1.2] as const;

export default function HomePage() {
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  return (
    <div className="min-h-screen">
      <PublicTopbar onOpenMemberModal={() => setMemberModalOpen(true)} activePath="/" />

      {/* ══ 3D HERO SECTION ══ */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-[60px]">
        <Hero3DCanvas />

        {/* Vignette overlay */}
        <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_60%_70%_at_30%_50%,transparent_30%,rgba(20,32,44,0.6)_100%),linear-gradient(to_right,rgba(20,32,44,0.55)_0%,transparent_55%)]" />

        <div className="pointer-events-none relative z-[3] max-w-[600px] px-6 md:px-[60px]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: HERO_EASE }}
            className="mb-[22px] inline-flex items-center gap-2 rounded-full border border-accent/22 bg-accent/12 px-3.5 py-1 text-[0.75rem] font-bold uppercase tracking-[0.07em] text-accent"
          >
            <Building2 className="h-3.5 w-3.5" />
            Iloilo City Public Library
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.25, ease: HERO_EASE }}
            className="mb-4 text-[clamp(2rem,4.5vw,3.2rem)] font-bold leading-[1.12] tracking-[-0.03em] text-white"
          >
            Welcome to the
            <br />
            <span className="text-accent">Heart of Knowledge</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.38, ease: HERO_EASE }}
            className="mb-8 max-w-[440px] text-[1rem] leading-[1.7] text-tl"
          >
            Dr. Graciano Lopez Jaena Learning Resource Center and Museum — your gateway to books,
            heritage, and lifelong learning.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.5, ease: HERO_EASE }}
            className="pointer-events-auto flex flex-wrap gap-3"
          >
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-[0.92rem] font-bold text-on-accent transition hover:-translate-y-0.5 hover:bg-[#b8d4ec]"
            >
              <BookOpen className="h-4 w-4" /> Explore Books
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-transparent px-[22px] py-[11px] text-[0.92rem] font-semibold text-white transition hover:border-white/50 hover:bg-white/8"
            >
              <Compass className="h-4 w-4" /> Our Features
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.65, ease: HERO_EASE }}
          className="pointer-events-none absolute bottom-4 right-4 z-[4] inline-flex items-center gap-2 rounded-full border border-accent/18 bg-bg1/70 px-3.5 py-1.5 text-[0.72rem] font-semibold tracking-[0.03em] text-accent/70 backdrop-blur-md md:bottom-7 md:right-10"
        >
          <Move className="h-3.5 w-3.5" /> Drag to orbit &nbsp;·&nbsp; Scroll to zoom
        </motion.div>
      </section>

      {/* ══ LIBRARY OFFERINGS (AUTOMATIC CAROUSEL) ══ */}
      <OfferingsSection />

      {/* ══ FEATURES ══ */}
      <section id="features" className="px-5 py-16 md:px-10 md:py-[100px]">
        <Reveal direction="flip" className="mb-12 text-center">
          <h2 className="mb-2 text-[2rem] font-bold tracking-[-0.02em] text-white">
            What We <span className="text-accent">Offer</span>
          </h2>
          <p className="text-[0.92rem] text-tl">Everything you need — all in one place.</p>
        </Reveal>

        <StaggerGroup className="mx-auto grid max-w-[1200px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, locked, desc }) => (
            <StaggerItem key={title}>
              <div
                onClick={locked ? () => setMemberModalOpen(true) : undefined}
                className={`group relative h-full overflow-hidden rounded-[18px] border border-white/8 bg-card-glass px-[26px] py-7 backdrop-blur-sm transition duration-250 hover:-translate-y-1.5 hover:bg-card-glass-hover hover:shadow-[0_16px_40px_rgba(0,0,0,0.2)] ${locked ? "cursor-pointer" : ""}`}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent to-transparent opacity-0 transition-opacity duration-250 group-hover:opacity-100" />
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[11px] bg-accent/15 text-accent transition group-hover:bg-accent/25">
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[0.95rem] font-bold text-white">
                  {title}
                  {locked && (
                    <LibraryTooltip label="Members only">
                      <Lock className="h-3.5 w-3.5 text-[#FFD700] drop-shadow-[0_0_3px_rgba(255,215,0,0.5)]" />
                    </LibraryTooltip>
                  )}
                </h4>
                <p className="text-[0.82rem] leading-[1.7] text-tl">{desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* ══ VISION & MISSION ══ */}
      <section id="Vission_and_Mission" className="bg-black/10 px-5 py-16 md:px-10 md:py-[100px]">
        <Reveal direction="zoom" className="mb-12 text-center">
          <h2 className="mb-2 text-[2rem] font-bold tracking-[-0.02em] text-white">
            Our Vision <span className="text-accent">&amp; Mission</span>
          </h2>
          <p className="text-[0.92rem] text-tl">The values that guide everything we do.</p>
        </Reveal>

        <Reveal direction="slide">
          <div className="mx-auto mb-10 max-w-[780px] rounded-[18px] border border-accent/18 bg-accent/7 px-6 py-7 text-center backdrop-blur-sm md:px-[34px] md:py-[30px]">
            <h4 className="mb-3 inline-flex items-center gap-2 text-[0.92rem] font-bold uppercase tracking-[0.05em] text-accent">
              <Sparkles className="h-4 w-4" /> Mandate
            </h4>
            <p className="text-[0.85rem] leading-[1.8] text-tl">
              Republic Act No. 7743, June 17, 1994 — An act providing for the establishment of
              congressional, city and municipal libraries and barangay reading centers throughout
              the Philippines, appropriating the necessary funds therefor and for other purposes.
            </p>
          </div>
        </Reveal>

        <StaggerGroup className="mx-auto grid max-w-[960px] grid-cols-1 gap-5 md:grid-cols-2">
          <StaggerItem>
            <div className="h-full rounded-[18px] border border-white/8 bg-card-glass px-[26px] py-[30px] backdrop-blur-sm transition duration-250 hover:-translate-y-1.5 hover:bg-card-glass-hover">
              <h4 className="mb-3 flex items-center gap-2 text-[0.92rem] font-bold uppercase tracking-[0.05em] text-accent">
                <Eye className="h-4 w-4" /> Vision
              </h4>
              <p className="text-[0.85rem] leading-[1.7] text-tl">
                The Iloilo City Public Library empowers Ilonggos through lifelong learning and
                cultural preservation, cultivating information-literate and skilled citizens who
                actively contribute to a livable, sustainable, and well-governed Iloilo with a
                robust and inclusive economy.
              </p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="h-full rounded-[18px] border border-white/8 bg-card-glass px-[26px] py-[30px] backdrop-blur-sm transition duration-250 hover:-translate-y-1.5 hover:bg-card-glass-hover">
              <h4 className="mb-3 flex items-center gap-2 text-[0.92rem] font-bold uppercase tracking-[0.05em] text-accent">
                <Target className="h-4 w-4" /> Mission
              </h4>
              <p className="text-[0.85rem] leading-[1.7] text-tl">
                Provides inclusive and responsive services that empower the Ilonggo community
                through equitable access to information and resources, preserving our cultural
                heritage and fostering the development of a livable, sustainable, and resilient
                city.
              </p>
            </div>
          </StaggerItem>
        </StaggerGroup>
      </section>

      {/* ══ SERVICES & RESOURCES ══ */}
      <section id="services" className="px-5 py-16 md:px-10 md:py-[100px]">
        <div className="mx-auto max-w-[1100px]">
          <Reveal direction="flip" className="mb-14 text-center">
            <h2 className="mb-2 text-[2rem] font-bold tracking-[-0.02em] text-white">
              Services <span className="text-accent">&amp; Resources</span>
            </h2>
            <p className="text-[0.92rem] text-tl">What we provide for our community.</p>
          </Reveal>

          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-14">
            <Reveal direction="left">
              <h3 className="mb-5 text-[1.45rem] font-bold tracking-[-0.02em] text-white">
                Readers&apos; <span className="text-accent">Services</span>
              </h3>
              <ul className="space-y-2.5 text-[0.85rem] leading-[1.6] text-tl">
                {[
                  "Free study and work space with WiFi",
                  "Book Collections: Reference, Filipiniana, General Collection, Rare Books, Children's Corner, Fiction, and Periodicals",
                  "Regular outreach to schools and libraries through literacy programs and book donations",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-accent2/30 bg-accent2/13 text-accent2">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal direction="right">
              <div className="aspect-[4/3] overflow-hidden rounded-[18px] border border-white/8 shadow-[0_16px_48px_rgba(0,0,0,0.3)]">
                <img
                  src="/static/images/readers1.jpg"
                  alt="Readers' Services"
                  className="h-full w-full object-cover"
                />
              </div>
            </Reveal>
          </div>

          <div className="mt-[72px] grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-14">
            <Reveal direction="left" className="order-2 md:order-1">
              <div className="aspect-[4/3] overflow-hidden rounded-[18px] border border-white/8 shadow-[0_16px_48px_rgba(0,0,0,0.3)]">
                <img
                  src="/static/images/readers2.jpg"
                  alt="Archives"
                  className="h-full w-full object-cover"
                />
              </div>
            </Reveal>

            <Reveal direction="right" className="order-1 md:order-2">
              <h3 className="mb-5 text-[1.45rem] font-bold tracking-[-0.02em] text-white">
                <span className="text-accent">Archives</span>
              </h3>
              <ul className="space-y-2.5 text-[0.85rem] leading-[1.6] text-tl">
                {[
                  "Inventory and disposal of records for Iloilo Provincial Government Offices and district hospitals",
                  "Digitization and preservation",
                  "Safekeeping of historical and cultural resources of Iloilo Province",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-accent2/30 bg-accent2/13 text-accent2">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <PublicFooter onOpenLegal={setLegalModal} />

      <MembershipModal open={memberModalOpen} onOpenChange={setMemberModalOpen} />
      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
