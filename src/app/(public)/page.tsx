"use client";

import { useState } from "react";
import { Compass } from "lucide-react";
import { PublicTopbar } from "@/components/landing/PublicTopbar";
import { BookHero } from "@/components/landing/BookHero";
import { OfferingsSection } from "@/components/landing/OfferingsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { VisionMissionSection } from "@/components/landing/VisionMissionSection";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { MembershipModal } from "@/components/landing/MembershipModal";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";

export default function HomePage() {
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  return (
    <div className="min-h-screen">
      <PublicTopbar onOpenMemberModal={() => setMemberModalOpen(true)} activePath="/" />

      <BookHero
        eyebrow="Iloilo City Public Library"
        headlineTop="Welcome to the"
        headlineAccent="Heart of Knowledge"
        description="Dr. Graciano Lopez Jaena Learning Resource Center and Museum — your gateway to books, heritage, and lifelong learning."
        primaryCta={{ href: "/browse", label: "Explore Books" }}
        secondaryCta={{
          href: "#features",
          label: "Our Features",
          icon: <Compass className="h-4 w-4" />,
        }}
      />

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
