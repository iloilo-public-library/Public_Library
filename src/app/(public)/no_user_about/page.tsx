"use client";

import { useState } from "react";
import { Building2, Clock, Mail, MapPin, Phone } from "lucide-react";
import { PublicTopbar } from "@/components/landing/PublicTopbar";
import { VisionMissionSection } from "@/components/landing/VisionMissionSection";
import { ServicesSection } from "@/components/landing/ServicesSection";
import { PublicFooter } from "@/components/landing/PublicFooter";
import { MembershipModal } from "@/components/landing/MembershipModal";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";
import { Reveal } from "@/components/ui/motion";

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
        <section className="mx-auto max-w-[1200px] px-5 pb-14 pt-8 md:px-10">
          <Reveal direction="up">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/12 px-3.5 py-1 font-mono text-[0.72rem] font-bold tracking-[0.12em] text-accent uppercase">
              <Building2 className="h-3.5 w-3.5" /> About Us
            </div>
            <h1 className="mb-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-tight tracking-[-0.03em] text-white">
              Iloilo City <span className="text-accent">Public Library</span>
            </h1>
            <p className="max-w-[720px] text-[0.95rem] leading-[1.8] text-tl/85">
              The Dr. Graciano Lopez Jaena Learning Resource Center and Museum serves as a free,
              inclusive hub for knowledge, academic research, cultural preservation, and community
              literacy across Iloilo City and Province.
            </p>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: MapPin,
                label: "Location",
                value: "Arguelles-Fajardo St., Jaro, Iloilo City 5000",
              },
              { icon: Clock, label: "Library Hours", value: "Mon – Sat · 8:00 AM – 8:00 PM" },
              { icon: Phone, label: "Telephone", value: "(033) 335-4078" },
              { icon: Mail, label: "Email", value: "iloilocitypubliclibrary@gmail.com" },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-card-glass p-5 backdrop-blur-sm"
              >
                <Icon className="mb-3 h-5 w-5 text-accent" />
                <div className="font-mono text-[0.68rem] uppercase tracking-wider text-white/45">
                  {label}
                </div>
                <div className="mt-1 text-sm font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <VisionMissionSection />
        <ServicesSection />
      </main>

      <PublicFooter onOpenLegal={setLegalModal} />
      <MembershipModal open={memberModalOpen} onOpenChange={setMemberModalOpen} />
      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
