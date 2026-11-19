"use client";

import {
  BookMarked,
  FolderKanban,
  HeartHandshake,
  Landmark,
  ScanLine,
  Wifi,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/motion";

const READERS_SERVICES = [
  {
    num: "01",
    icon: Wifi,
    title: "Study & Coworking Space",
    desc: "Free, quiet reading and working areas equipped with high-speed WiFi for students and professionals.",
  },
  {
    num: "02",
    icon: BookMarked,
    title: "Curated Book Collections",
    desc: "Reference, Filipiniana, General Collection, Rare Books, Children's Corner, Fiction, and Periodicals.",
  },
  {
    num: "03",
    icon: HeartHandshake,
    title: "Community Literacy Outreach",
    desc: "Regular outreach programs to local schools and barangay libraries through literacy drives and book donations.",
  },
];

const ARCHIVE_SERVICES = [
  {
    num: "01",
    icon: FolderKanban,
    title: "Provincial Records Management",
    desc: "Systematic inventory and disposal of records for Iloilo Provincial Government Offices and district hospitals.",
  },
  {
    num: "02",
    icon: ScanLine,
    title: "Digitization & Preservation",
    desc: "Modern digital archiving workflows protecting fragile manuscripts and historical volumes from deterioration.",
  },
  {
    num: "03",
    icon: Landmark,
    title: "Cultural Heritage Safekeeping",
    desc: "Dedicated stewardship of historical, documentary, and cultural resources representing Iloilo Province.",
  },
];

export function ServicesSection() {
  return (
    <section id="services" className="px-5 py-16 [content-visibility:auto] md:px-10 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        {/* Editorial Header */}
        <Reveal direction="up" className="mb-14 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1.5 font-mono text-[0.72rem] tracking-[0.14em] text-white/40 uppercase">
              LIB // 04 [SERVICES]
            </div>
            <div className="mb-1 font-mono text-[0.76rem] font-semibold tracking-[0.2em] text-accent2 uppercase">
              COMMUNITY RESOURCES
            </div>
            <h2 className="text-[clamp(1.85rem,3.6vw,2.6rem)] font-bold leading-none tracking-[-0.03em] text-white uppercase">
              SERVICES &amp; <span className="text-accent">RESOURCES.</span>
            </h2>
          </div>
          <p className="max-w-[360px] text-[0.86rem] leading-relaxed text-tl/80">
            Dedicated public facilities and archival programs serving Iloilo City and Province.
          </p>
        </Reveal>

        {/* Row 1: Readers' Services */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <Reveal direction="left" className="mb-6">
              <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/12 px-3 py-1 font-mono text-[0.68rem] font-bold tracking-[0.12em] text-accent uppercase">
                DIVISION // 01
              </span>
              <h3 className="mt-3 text-[1.65rem] font-bold tracking-[-0.02em] text-white">
                Readers&apos; <span className="text-accent">Services</span>
              </h3>
            </Reveal>

            <StaggerGroup className="space-y-3">
              {READERS_SERVICES.map(({ num, icon: Icon, title, desc }) => (
                <StaggerItem key={num}>
                  <div className="group flex items-start gap-4 rounded-2xl border border-white/8 bg-card-glass p-4 transition duration-200 hover:border-accent/30 hover:bg-card-glass-hover">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/12 text-accent transition group-hover:bg-accent/22">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <h4 className="text-[0.92rem] font-bold text-white">{title}</h4>
                        <span className="font-mono text-[0.68rem] text-white/35">{num}</span>
                      </div>
                      <p className="text-[0.82rem] leading-[1.6] text-tl/80">{desc}</p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>

          <Reveal direction="right">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] border border-white/12 bg-bg1 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
              <img
                src="/static/images/readers1.jpg"
                alt="Readers' Services"
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent" />
              <div className="absolute bottom-4 left-4 rounded-full border border-white/15 bg-bg1/75 px-3 py-1 font-mono text-[0.7rem] tracking-[0.1em] text-white/85 uppercase backdrop-blur-md">
                HALL // READERS&apos; SERVICES
              </div>
            </div>
          </Reveal>
        </div>

        {/* Row 2: Archives */}
        <div className="mt-20 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal direction="left" className="order-2 lg:order-1">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] border border-white/12 bg-bg1 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
              <img
                src="/static/images/readers2.jpg"
                alt="Provincial Archives"
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent" />
              <div className="absolute bottom-4 left-4 rounded-full border border-white/15 bg-bg1/75 px-3 py-1 font-mono text-[0.7rem] tracking-[0.1em] text-white/85 uppercase backdrop-blur-md">
                VAULT // ILOILO ARCHIVES
              </div>
            </div>
          </Reveal>

          <div className="order-1 lg:order-2">
            <Reveal direction="right" className="mb-6">
              <span className="inline-flex items-center rounded-full border border-accent2/30 bg-accent2/12 px-3 py-1 font-mono text-[0.68rem] font-bold tracking-[0.12em] text-accent2 uppercase">
                DIVISION // 02
              </span>
              <h3 className="mt-3 text-[1.65rem] font-bold tracking-[-0.02em] text-white">
                Provincial <span className="text-accent">Archives</span>
              </h3>
            </Reveal>

            <StaggerGroup className="space-y-3">
              {ARCHIVE_SERVICES.map(({ num, icon: Icon, title, desc }) => (
                <StaggerItem key={num}>
                  <div className="group flex items-start gap-4 rounded-2xl border border-white/8 bg-card-glass p-4 transition duration-200 hover:border-accent2/30 hover:bg-card-glass-hover">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent2/25 bg-accent2/12 text-accent2 transition group-hover:bg-accent2/22">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <h4 className="text-[0.92rem] font-bold text-white">{title}</h4>
                        <span className="font-mono text-[0.68rem] text-white/35">{num}</span>
                      </div>
                      <p className="text-[0.82rem] leading-[1.6] text-tl/80">{desc}</p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </div>
      </div>
    </section>
  );
}
