"use client";

import { useState } from "react";
import { PublicTopbar } from "@/components/landing/PublicTopbar";
import { AboutUsContent } from "@/components/landing/AboutUsContent";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { MembershipModal } from "@/components/landing/MembershipModal";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";

export default function AboutUsPage() {
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  return (
    <div className="min-h-screen">
      <PublicTopbar
        onOpenMemberModal={() => setMemberModalOpen(true)}
        activePath="/no_user_about"
      />

      <main className="pt-[88px]">
        <AboutUsContent />
      </main>

      <PublicFooter onOpenLegal={setLegalModal} />
      <MembershipModal open={memberModalOpen} onOpenChange={setMemberModalOpen} />
      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
