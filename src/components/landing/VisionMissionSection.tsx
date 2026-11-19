"use client";

import { Eye, Scale, Target } from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/motion";

export function VisionMissionSection() {
  return (
    <section
      id="Vission_and_Mission"
      className="border-y border-white/8 bg-[#121e2b]/70 px-5 py-16 [content-visibility:auto] md:px-10 md:py-24"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* Editorial Header */}
        <Reveal direction="up" className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1.5 font-mono text-[0.72rem] tracking-[0.14em] text-white/40 uppercase">
              LIB // 03 [GOVERNANCE]
            </div>
            <div className="mb-1 font-mono text-[0.76rem] font-semibold tracking-[0.2em] text-accent2 uppercase">
              OUR PURPOSE
            </div>
            <h2 className="text-[clamp(1.85rem,3.6vw,2.6rem)] font-bold leading-none tracking-[-0.03em] text-white uppercase">
              VISION &amp; <span className="text-accent">MISSION.</span>
            </h2>
          </div>
          <p className="max-w-[360px] text-[0.86rem] leading-relaxed text-tl/80">
            Guided by national legislation and a shared commitment to lifelong learning in Iloilo
            City.
          </p>
        </Reveal>

        {/* Full-Width Mandate Card */}
        <Reveal direction="slide" className="mb-6">
          <div className="relative overflow-hidden rounded-[22px] border border-accent/25 bg-accent/8 p-7 backdrop-blur-sm md:p-9">
            {/* Left Accent Bar */}
            <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-accent to-accent2" />

            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="shrink-0">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3.5 py-1 font-mono text-[0.7rem] font-bold tracking-[0.1em] text-accent uppercase">
                  <Scale className="h-3.5 w-3.5" /> LEGAL MANDATE
                </span>
                <div className="mt-2.5 font-mono text-[0.74rem] tracking-[0.1em] text-white/45 uppercase">
                  REPUBLIC ACT NO. 7743 · JUNE 17, 1994
                </div>
              </div>

              <p className="max-w-[740px] text-[0.94rem] leading-[1.85] text-tl">
                An act providing for the establishment of congressional, city and municipal
                libraries and barangay reading centers throughout the Philippines, appropriating
                the necessary funds therefor and for other purposes.
              </p>
            </div>
          </div>
        </Reveal>

        {/* Vision & Mission Pillars */}
        <StaggerGroup className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <StaggerItem>
            <div className="group relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-card-glass p-7 backdrop-blur-sm transition duration-250 hover:-translate-y-1 hover:border-accent/35 hover:bg-card-glass-hover md:p-8">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/25 bg-accent/15 text-accent">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-mono text-[0.68rem] tracking-[0.14em] text-white/40 uppercase">
                      PILLAR // 01
                    </div>
                    <h3 className="text-[1.15rem] font-bold tracking-[-0.01em] text-white uppercase">
                      Our Vision
                    </h3>
                  </div>
                </div>
                <span className="font-mono text-[1.6rem] font-bold text-white/8">01</span>
              </div>

              <p className="text-[0.9rem] leading-[1.8] text-tl/85">
                The Iloilo City Public Library empowers Ilonggos through lifelong learning and
                cultural preservation, cultivating information-literate and skilled citizens who
                actively contribute to a livable, sustainable, and well-governed Iloilo with a
                robust and inclusive economy.
              </p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="group relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-card-glass p-7 backdrop-blur-sm transition duration-250 hover:-translate-y-1 hover:border-accent2/35 hover:bg-card-glass-hover md:p-8">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-accent2/25 bg-accent2/15 text-accent2">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-mono text-[0.68rem] tracking-[0.14em] text-white/40 uppercase">
                      PILLAR // 02
                    </div>
                    <h3 className="text-[1.15rem] font-bold tracking-[-0.01em] text-white uppercase">
                      Our Mission
                    </h3>
                  </div>
                </div>
                <span className="font-mono text-[1.6rem] font-bold text-white/8">02</span>
              </div>

              <p className="text-[0.9rem] leading-[1.8] text-tl/85">
                Provides inclusive and responsive services that empower the Ilonggo community
                through equitable access to information and resources, preserving our cultural
                heritage and fostering the development of a livable, sustainable, and resilient
                city.
              </p>
            </div>
          </StaggerItem>
        </StaggerGroup>
      </div>
    </section>
  );
}
