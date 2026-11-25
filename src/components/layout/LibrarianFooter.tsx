"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  Clock,
  FilePlus2,
  History,
  Home,
  LayoutDashboard,
  Mail,
  MapPin,
  Megaphone,
  Package,
  Phone,
  Users,
} from "lucide-react";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";
import { cn } from "@/lib/utils";

interface LibrarianFooterProps {
  collapsed: boolean;
}

const QUICK_LINKS = [
  { href: "/librarian/home", label: "Home", icon: Home },
  { href: "/librarian/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/librarian/announcements", label: "Announcements", icon: Megaphone },
  { href: "/librarian/calendar", label: "Event Calendar", icon: CalendarDays },
  { href: "/librarian/inventory", label: "Inventory", icon: Package },
];

const MANAGEMENT_LINKS = [
  { href: "/librarian/books", label: "Book Management", icon: BookOpen },
  { href: "/librarian/users", label: "Member Records", icon: Users },
  { href: "/librarian/library-cards", label: "Add Borrow", icon: FilePlus2 },
  { href: "/librarian/records-returns", label: "Borrow History", icon: History },
];

export function LibrarianFooter({ collapsed }: LibrarianFooterProps) {
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);
  const year = new Date().getFullYear();

  return (
    <div
      className={cn(
        "transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        collapsed ? "lg:pl-[64px]" : "lg:pl-[240px]"
      )}
    >
      {/* Pre-Footer CTA Band */}
      <div className="border-t border-accent/12 bg-gradient-to-r from-accent/10 via-accent2/6 to-transparent px-6 py-10 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-6">
          <div className="max-w-[520px]">
            <h3 className="mb-1.5 text-[1.25rem] font-bold tracking-[-0.02em] text-white">
              Manage the Library Collection
            </h3>
            <p className="text-[0.84rem] leading-relaxed text-tl/80">
              Access book management, member records, borrowing history, and the event calendar —
              everything you need to keep the library running smoothly.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/librarian/books"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[0.84rem] font-bold text-on-accent transition hover:-translate-y-0.5 hover:bg-[#b8d4ec]"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" /> Manage Books
            </Link>
            <Link
              href="/librarian/dashboard"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/18 bg-white/5 px-5 py-2.5 text-[0.84rem] font-semibold text-white/80 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <footer className="border-t border-white/8 bg-[#121e2b] px-6 pt-12 lg:px-10">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid grid-cols-1 gap-10 border-b border-white/8 pb-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.35fr]">
            {/* Brand */}
            <div>
              <div className="mb-3.5 flex items-center gap-3">
                <img
                  src="/images/logo.png"
                  alt="Iloilo City Public Library Logo"
                  className="h-10 w-10 rounded-lg object-cover"
                />
                <div>
                  <div className="text-[0.92rem] font-bold text-white">
                    Iloilo City Public Library
                  </div>
                  <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.04em] text-accent">
                    Dr. Graciano Lopez Jaena LRC &amp; Museum
                  </span>
                </div>
              </div>
              <p className="mb-5 max-w-[260px] text-[0.8rem] leading-[1.75] text-white/45">
                Empowering the Iloilo community through access to knowledge, cultural heritage, and
                lifelong learning.
              </p>
              <div className="flex items-center gap-2">
                <a
                  href="https://www.facebook.com/iloilocitypubliclibrary"
                  target="_blank"
                  rel="noreferrer"
                  title="Facebook"
                  aria-label="Facebook"
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-white/55 transition hover:border-accent/30 hover:bg-accent/15 hover:text-accent"
                >
                  f
                </a>
                <a
                  href="mailto:iloilocitypubliclibrary@gmail.com"
                  title="Email Us"
                  aria-label="Email Us"
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/55 transition hover:border-accent/30 hover:bg-accent/15 hover:text-accent"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <div className="mb-4 border-b border-white/6 pb-2.5 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-white/35">
                Quick Links
              </div>
              <ul className="space-y-1 text-[0.82rem]">
                {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex items-center gap-2 py-1 font-medium text-white/55 transition hover:text-accent"
                    >
                      <Icon className="h-3.5 w-3.5 text-accent/45" aria-hidden="true" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Management */}
            <div>
              <div className="mb-4 border-b border-white/6 pb-2.5 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-white/35">
                Management
              </div>
              <ul className="space-y-1 text-[0.82rem]">
                {MANAGEMENT_LINKS.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex items-center gap-2 py-1 font-medium text-white/55 transition hover:text-accent"
                    >
                      <Icon className="h-3.5 w-3.5 text-accent/45" aria-hidden="true" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <div className="mb-4 border-b border-white/6 pb-2.5 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-white/35">
                Get in Touch
              </div>
              <div className="space-y-2.5 text-[0.78rem]">
                <div className="flex items-start gap-2.5 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent/75" aria-hidden="true" />
                  <div>
                    <span className="block text-[0.6rem] font-bold uppercase tracking-[0.07em] text-white/30">
                      Address
                    </span>
                    <span className="text-white/70">
                      Arguelles-Fajardo Street, Jaro,
                      <br />
                      Iloilo City, Philippines, 5000
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent/75" aria-hidden="true" />
                  <div>
                    <span className="block text-[0.6rem] font-bold uppercase tracking-[0.07em] text-white/30">
                      Telephone
                    </span>
                    <a href="tel:+6333354078" className="text-white/70 transition hover:text-accent">
                      (033) 335-4078
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent/75" aria-hidden="true" />
                  <div>
                    <span className="block text-[0.6rem] font-bold uppercase tracking-[0.07em] text-white/30">
                      Email
                    </span>
                    <a
                      href="mailto:iloilocitypubliclibrary@gmail.com"
                      className="text-white/70 transition hover:text-accent"
                    >
                      iloilocitypubliclibrary@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent/75" aria-hidden="true" />
                  <div>
                    <span className="block text-[0.6rem] font-bold uppercase tracking-[0.07em] text-white/30">
                      Library Hours
                    </span>
                    <span className="text-white/70">
                      Mon – Sat &nbsp;·&nbsp; 8:00 AM – 8:00 PM
                      <br />
                      <span className="text-[0.72rem] text-white/35">
                        Closed on Sundays &amp; public holidays
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Partners Belt */}
          <div className="flex flex-wrap items-center gap-5 border-b border-white/6 py-6">
            <span className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/25">
              In partnership with
            </span>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex flex-wrap items-center gap-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <img
                  key={n}
                  src="/images/partner_logo.png"
                  alt={`Partner ${n}`}
                  className="h-7 w-auto object-contain opacity-35 grayscale brightness-200 transition hover:scale-105 hover:opacity-80 hover:grayscale-0 hover:brightness-100"
                />
              ))}
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-5 text-[0.75rem]">
            <div className="text-white/30">
              &copy; <strong className="text-white/45">{year}</strong>{" "}
              <strong className="text-white/45">Iloilo City Public Library</strong> — Dr. Graciano
              Lopez Jaena Learning Resource Center &amp; Museum. All rights reserved.
            </div>
            <div className="flex flex-wrap items-center gap-3.5 text-white/35">
              <button
                type="button"
                onClick={() => setLegalModal("privacy")}
                className="min-h-[44px] transition hover:text-white/75 cursor-pointer"
              >
                Privacy Policy
              </button>
              <span className="h-1 w-1 rounded-full bg-white/15" />
              <button
                type="button"
                onClick={() => setLegalModal("terms")}
                className="min-h-[44px] transition hover:text-white/75 cursor-pointer"
              >
                Terms of Use
              </button>
              <span className="h-1 w-1 rounded-full bg-white/15" />
              <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/4 px-2.5 py-0.5 text-[0.7rem] font-semibold text-white/30">
                <MapPin className="h-3 w-3 text-accent/60" aria-hidden="true" /> Iloilo, Philippines
              </span>
            </div>
          </div>
        </div>
      </footer>

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
