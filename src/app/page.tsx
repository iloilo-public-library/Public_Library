"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Building2, Compass, Move } from "lucide-react";
import { PublicTopbar } from "@/components/landing/PublicTopbar";
import { OfferingsSection } from "@/components/landing/OfferingsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { VisionMissionSection } from "@/components/landing/VisionMissionSection";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { MembershipModal } from "@/components/landing/MembershipModal";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";

const Hero3DCanvas = dynamic(
  () => import("@/components/landing/Hero3DCanvas").then((mod) => mod.Hero3DCanvas),
  { ssr: false }
);

const HERO_EASE = [0.22, 0.68, 0, 1] as const;

export default function HomePage() {
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  return (
    <div className="min-h-screen">
      <PublicTopbar onOpenMemberModal={() => setMemberModalOpen(true)} activePath="/" />

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
            Iloilo City Public Library
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.14, ease: HERO_EASE }}
            className="mb-4 text-[clamp(2rem,4.5vw,3.2rem)] font-bold leading-[1.12] tracking-[-0.03em] text-white"
          >
            Welcome to the
            <br />
            <span className="text-accent">Heart of Knowledge</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.22, ease: HERO_EASE }}
            className="mb-8 max-w-[440px] text-[1rem] leading-[1.7] text-tl"
          >
            Dr. Graciano Lopez Jaena Learning Resource Center and Museum — your gateway to books,
            heritage, and lifelong learning.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3, ease: HERO_EASE }}
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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.38, ease: HERO_EASE }}
          className="pointer-events-none absolute bottom-4 right-4 z-[4] inline-flex items-center gap-2 rounded-full border border-accent/18 bg-bg1/70 px-3.5 py-1.5 text-[0.72rem] font-semibold tracking-[0.03em] text-accent/70 backdrop-blur-md md:bottom-7 md:right-10"
        >
          <Move className="h-3.5 w-3.5" /> Drag to orbit &nbsp;·&nbsp; Scroll to zoom
        </motion.div>
      </section>

      <OfferingsSection catalogHref="/browse" />
      <FeaturesSection mode="public" onOpenMemberModal={() => setMemberModalOpen(true)} />
      <VisionMissionSection />
      <ServicesSection />

      <PublicFooter onOpenLegal={setLegalModal} />

      <MembershipModal open={memberModalOpen} onOpenChange={setMemberModalOpen} />
      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
