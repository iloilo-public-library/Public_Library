"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BookmarkCheck,
  Building2,
  CalendarDays,
  Lock,
  Search,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { LibraryTooltip } from "@/components/ui/tooltip";

interface FeaturesSectionProps {
  mode: "public" | "member";
  onOpenMemberModal?: () => void;
}

export function FeaturesSection({ mode, onOpenMemberModal }: FeaturesSectionProps) {
  const isPublic = mode === "public";

  const items = isPublic
    ? [
        {
          num: "01",
          icon: Search,
          title: "Book Catalog & Search",
          tag: "OPEN ACCESS",
          locked: false,
          href: "/browse",
          cta: "Browse Catalog",
          desc: "Browse thousands of titles across all categories — from Philippine literature to science, technology, and more.",
        },
        {
          num: "02",
          icon: BookmarkCheck,
          title: "Book Borrowing",
          tag: "MEMBERS ONLY",
          locked: true,
          href: null,
          cta: "Requires Membership",
          desc: "Check out books for home reading. Track your borrowed titles, renewals, and due dates from your member profile.",
        },
        {
          num: "03",
          icon: Building2,
          title: "Local History Archive",
          tag: "MEMBERS ONLY",
          locked: true,
          href: null,
          cta: "Requires Membership",
          desc: "Explore Iloilo's rich heritage through curated documents, photographs, and rare historical texts.",
        },
        {
          num: "04",
          icon: CalendarDays,
          title: "Events & Programs",
          tag: "MEMBERS ONLY",
          locked: true,
          href: null,
          cta: "Requires Membership",
          desc: "Join storytelling sessions, author talks, literacy workshops, and community events throughout the year.",
        },
      ]
    : [
        {
          num: "01",
          icon: Search,
          title: "Book Catalog & Search",
          tag: "CATALOG",
          locked: false,
          href: "/user/browse",
          cta: "Open Catalog",
          desc: "Search thousands of cataloged titles, save favorites, and check real-time copy availability.",
        },
        {
          num: "02",
          icon: BookmarkCheck,
          title: "Borrowed Books",
          tag: "CIRCULATION",
          locked: false,
          href: "/user/borrowed",
          cta: "View Borrowed",
          desc: "Track your active borrowed titles, request renewals, and monitor upcoming due dates.",
        },
        {
          num: "03",
          icon: Building2,
          title: "Borrowing History",
          tag: "RECORDS",
          locked: false,
          href: "/user/borrow-history",
          cta: "View History",
          desc: "Review past return records and download your digital Iloilo City Public Library card PDF.",
        },
        {
          num: "04",
          icon: CalendarDays,
          title: "Events & Programs",
          tag: "COMMUNITY",
          locked: false,
          href: "/user/event",
          cta: "Explore Events",
          desc: "Join storytelling sessions, author talks, literacy workshops, and community programs.",
        },
      ];

  return (
    <section id="features" className="px-5 py-16 [content-visibility:auto] md:px-10 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        {/* Editorial Section Header */}
        <Reveal direction="up" className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1.5 font-mono text-[0.72rem] tracking-[0.14em] text-white/40 uppercase">
              LIB // 02 [PLATFORM]
            </div>
            <div className="mb-1 font-mono text-[0.76rem] font-semibold tracking-[0.2em] text-accent2 uppercase">
              {isPublic ? "WHAT WE OFFER" : "MEMBER ACCESS"}
            </div>
            <h2 className="text-[clamp(1.85rem,3.6vw,2.6rem)] font-bold leading-none tracking-[-0.03em] text-white uppercase">
              BUILT FOR <span className="text-accent">READERS.</span>
            </h2>
          </div>
          <p className="max-w-[360px] text-[0.86rem] leading-relaxed text-tl/80">
            Everything you need for research, borrowing, and lifelong learning — unified in one
            secure portal.
          </p>
        </Reveal>

        {/* Cards Grid */}
        <StaggerGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ num, icon: Icon, title, tag, locked, href, cta, desc }) => {
            const cardInner = (
              <div className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-white/10 bg-card-glass p-6 backdrop-blur-sm transition duration-250 hover:-translate-y-1 hover:border-accent/35 hover:bg-card-glass-hover hover:shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
                {/* Top Accent Line on Hover */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent via-accent2 to-transparent opacity-0 transition-opacity duration-250 group-hover:opacity-100" />

                {/* Top Meta Row: Number + Status Pill */}
                <div className="mb-5 flex items-center justify-between gap-2">
                  <span className="font-mono text-[0.72rem] font-bold tracking-[0.12em] text-white/35">
                    // {num}
                  </span>
                  {locked ? (
                    <LibraryTooltip label="Sign in with a valid library card to access">
                      <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-mono text-[0.64rem] font-bold tracking-[0.08em] text-gold uppercase">
                        <Lock className="h-2.5 w-2.5" /> {tag}
                      </span>
                    </LibraryTooltip>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-accent2/30 bg-accent2/12 px-2.5 py-0.5 font-mono text-[0.64rem] font-bold tracking-[0.08em] text-accent2 uppercase">
                      {tag}
                    </span>
                  )}
                </div>

                {/* Icon Container */}
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/12 text-accent transition duration-250 group-hover:scale-105 group-hover:bg-accent/22">
                  <Icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <h3 className="mb-2 text-[1.02rem] font-bold tracking-[-0.01em] text-white">
                  {title}
                </h3>
                <p className="mb-6 flex-1 text-[0.83rem] leading-[1.68] text-tl/80">{desc}</p>

                {/* Bottom Action Strip */}
                <div className="flex items-center justify-between border-t border-white/8 pt-3.5 font-mono text-[0.72rem] font-semibold tracking-[0.06em] text-accent uppercase">
                  <span>{cta}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </div>
            );

            return (
              <StaggerItem key={num}>
                {href ? (
                  <Link href={href} className="block h-full">
                    {cardInner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenMemberModal}
                    className="block h-full w-full text-left cursor-pointer"
                  >
                    {cardInner}
                  </button>
                )}
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}
