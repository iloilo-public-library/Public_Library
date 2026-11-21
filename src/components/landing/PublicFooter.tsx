"use client";

import Link from "next/link";
import {
  Archive,
  BookOpen,
  Clock,
  Eye,
  Home,
  Info,
  LayoutGrid,
  Layers,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Search,
  Users,
  Wifi,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/motion";
import { LibraryTooltip } from "@/components/ui/tooltip";
import type { LegalModalType } from "@/components/landing/LegalModal";

export function PublicFooter({
  onOpenLegal,
}: {
  onOpenLegal: (type: LegalModalType) => void;
}) {
  const year = new Date().getFullYear();

  return (
    <>
      {/* Footer CTA Banner */}
      <Reveal direction="up">
        <div className="border-t border-accent/12 bg-gradient-to-r from-bg1/90 via-bg2/90 to-bg1/90 px-6 py-12 lg:px-14">
          <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-[600px]">
              <h3 className="mb-2 text-[1.4rem] font-bold tracking-[-0.02em] text-white">
                Ready to Start Exploring?
              </h3>
              <p className="text-[0.86rem] leading-[1.7] text-tl">
                Become a library member today and unlock access to thousands of books, historical
                archives, events, and free study spaces — open to everyone in the Iloilo community.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/browse"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-[0.86rem] font-bold text-on-accent transition hover:-translate-y-0.5 hover:bg-[#b8d4ec]"
              >
                <BookOpen className="h-4 w-4" /> Browse Catalog
              </Link>
              <Link
                href="/no_user_about"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/6 px-5 py-3 text-[0.86rem] font-semibold text-white transition hover:border-white/40 hover:bg-white/12"
              >
                <Info className="h-4 w-4" /> Learn More
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Main Footer */}
      <footer className="border-t border-white/8 bg-[#121e2b] px-6 pt-14 lg:px-14">
        <StaggerGroup className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 pb-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
          {/* Brand Column */}
          <StaggerItem>
            <div className="mb-4 flex items-center gap-3">
              <img
                src="/images/logo.png"
                alt="Logo"
                className="h-10 w-10 rounded-lg object-cover"
              />
              <div>
                <div className="text-[0.95rem] font-bold text-white">
                  Iloilo City Public Library
                </div>
                <span className="text-[0.72rem] text-accent/70">
                  Dr. Graciano Lopez Jaena LRC &amp; Museum
                </span>
              </div>
            </div>
            <p className="mb-5 text-[0.82rem] leading-[1.7] text-white/50">
              Empowering the Iloilo community through access to knowledge, cultural heritage, and
              lifelong learning.
            </p>
            <div className="flex items-center gap-2.5">
              <LibraryTooltip label="Facebook Page">
                <a
                  href="https://www.facebook.com/iloilocitypubliclibrary"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/65 transition hover:border-accent/30 hover:bg-accent/15 hover:text-accent"
                >
                  <span className="text-xs font-bold">f</span>
                </a>
              </LibraryTooltip>
              <LibraryTooltip label="Email Us">
                <a
                  href="mailto:iloilocitypubliclibrary@gmail.com"
                  aria-label="Email Us"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/65 transition hover:border-accent/30 hover:bg-accent/15 hover:text-accent"
                >
                  <Mail className="h-4 w-4" />
                </a>
              </LibraryTooltip>
            </div>
          </StaggerItem>

          {/* Quick Links */}
          <StaggerItem>
            <div className="mb-4 text-[0.75rem] font-bold uppercase tracking-[0.08em] text-accent">
              Quick Links
            </div>
            <ul className="space-y-1.5 text-[0.825rem]">
              {[
                { href: "/", label: "Home", icon: Home },
                { href: "/browse", label: "Browse Catalog", icon: Search },
                { href: "#features", label: "Features", icon: LayoutGrid },
                { href: "#Vission_and_Mission", label: "Vision & Mission", icon: Eye },
                { href: "/no_user_about", label: "About Us", icon: Info },
                { href: "/login", label: "Member Login", icon: LogIn },
              ].map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-2 py-1 font-medium text-white/55 transition hover:text-accent"
                  >
                    <Icon className="h-3.5 w-3.5 text-accent/45" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </StaggerItem>

          {/* Services */}
          <StaggerItem>
            <div className="mb-4 text-[0.75rem] font-bold uppercase tracking-[0.08em] text-accent">
              Services
            </div>
            <ul className="space-y-1.5 text-[0.825rem]">
              {[
                { label: "Free WiFi & Study Space", icon: Wifi },
                { label: "Iloilo Archives", icon: Archive },
                { label: "General Collection", icon: Layers },
                { label: "Reference Collection", icon: BookOpen },
                { label: "Literacy Outreach Programs", icon: Users },
              ].map(({ label, icon: Icon }) => (
                <li
                  key={label}
                  className="flex select-none items-center gap-2 py-1 font-medium text-white/38"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-accent/30" />
                  {label}
                </li>
              ))}
            </ul>
          </StaggerItem>

          {/* Contact */}
          <StaggerItem>
            <div className="mb-4 text-[0.75rem] font-bold uppercase tracking-[0.08em] text-accent">
              Get in Touch
            </div>
            <div className="space-y-3 text-[0.82rem]">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent/70" />
                <div>
                  <span className="block text-[0.68rem] font-bold uppercase tracking-[0.05em] text-white/35">
                    Address
                  </span>
                  <span className="text-white/65">
                    Arguelles-Fajardo Street, Jaro,
                    <br />
                    Iloilo City, Philippines, 5000
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent/70" />
                <div>
                  <span className="block text-[0.68rem] font-bold uppercase tracking-[0.05em] text-white/35">
                    Telephone
                  </span>
                  <a href="tel:+6333354078" className="text-white/65 transition hover:text-accent">
                    (033) 335-4078
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent/70" />
                <div>
                  <span className="block text-[0.68rem] font-bold uppercase tracking-[0.05em] text-white/35">
                    Email
                  </span>
                  <a
                    href="mailto:iloilocitypubliclibrary@gmail.com"
                    className="text-white/65 transition hover:text-accent"
                  >
                    iloilocitypubliclibrary@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent/70" />
                <div>
                  <span className="block text-[0.68rem] font-bold uppercase tracking-[0.05em] text-white/35">
                    Library Hours
                  </span>
                  <span className="text-white/65">
                    Mon – Sat &nbsp;·&nbsp; 8:00 AM – 8:00 PM
                    <br />
                    <span className="text-[0.72rem] text-white/32">
                      Closed on Sundays &amp; public holidays
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </StaggerItem>
        </StaggerGroup>

        {/* Bottom Bar */}
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-3 border-t border-white/8 py-5 text-[0.76rem] text-white/40 sm:flex-row sm:items-center">
          <div>
            &copy; <strong className="text-white/65">{year}</strong>{" "}
            <strong className="text-white/65">Iloilo City Public Library</strong> — Dr. Graciano
            Lopez Jaena Learning Resource Center &amp; Museum. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenLegal("privacy")}
              className="transition hover:text-accent cursor-pointer"
            >
              Privacy Policy
            </button>
            <span className="h-3 w-px bg-white/15" />
            <button
              type="button"
              onClick={() => onOpenLegal("terms")}
              className="transition hover:text-accent cursor-pointer"
            >
              Terms of Use
            </button>
            <span className="h-3 w-px bg-white/15" />
            <Link href="/no_user_about" className="transition hover:text-accent">
              About
            </Link>
            <span className="h-3 w-px bg-white/15" />
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/15 bg-accent/8 px-2.5 py-0.5 text-[0.7rem] font-semibold text-accent">
              <MapPin className="h-3 w-3" /> Iloilo, Philippines
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
