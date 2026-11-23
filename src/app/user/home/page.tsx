"use client";

import { useState } from "react";
import { Compass } from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { BookHero } from "@/components/landing/BookHero";
import { OfferingsSection } from "@/components/landing/OfferingsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { VisionMissionSection } from "@/components/landing/VisionMissionSection";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";

export default function UserHomePage() {
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  return (
    <MemberShell fullBleed>
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
    </MemberShell>
  );
}
