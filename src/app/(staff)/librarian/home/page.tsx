"use client";

import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Package,
  RotateCcw,
  Settings,
  UserCheck,
  Users,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { swrPrivateConfig } from "@/lib/api";
import type { DashboardStats } from "@/types/library";

const QUICK_MODULES = [
  {
    href: "/librarian/dashboard",
    label: "Analytics Dashboard",
    desc: "Live library KPIs, stock breakdown, and circulation metrics",
    icon: LayoutDashboard,
  },
  {
    href: "/librarian/inventory",
    label: "Inventory Status",
    desc: "Track physical copies, shelf locations, damaged & lost items",
    icon: Package,
  },
  {
    href: "/librarian/books",
    label: "Book Management",
    desc: "Catalog records, ISBN lookup, and borrowing eligibility",
    icon: BookOpen,
  },
  {
    href: "/librarian/library-cards",
    label: "Library Cards",
    desc: "Issue member and borrower cards, renewals, and due dates",
    icon: CreditCard,
  },
  {
    href: "/librarian/records-returns",
    label: "Records & Returns",
    desc: "Circulation return logs and restocked copy quantities",
    icon: RotateCcw,
  },
  {
    href: "/librarian/users",
    label: "User Management",
    desc: "View registered patron accounts and account status",
    icon: Users,
  },
  {
    href: "/librarian/account-requests",
    label: "Renewal Requests",
    desc: "Review and approve pending library card renewal requests",
    icon: UserCheck,
  },
  {
    href: "/librarian/calendar",
    label: "Calendar Events",
    desc: "Library programs, workshops, and community schedules",
    icon: CalendarDays,
  },
  {
    href: "/librarian/announcements",
    label: "Announcements",
    desc: "Publish notices, reminders, and community bulletins",
    icon: Megaphone,
  },
  {
    href: "/librarian/settings",
    label: "Librarian Settings",
    desc: "Manage personal details, password, security flags, and sessions",
    icon: Settings,
  },
];

export default function LibrarianHomePage() {
  const { data: stats } = useSWR<DashboardStats>("/api/dashboard/stats", swrPrivateConfig);

  return (
    <StaffShell title="Librarian Home" role="librarian">
      <div className="mb-8 rounded-[22px] border border-accent/20 bg-card-glass p-6 backdrop-blur-sm md:p-8">
        <div className="mb-2 font-mono text-[0.72rem] tracking-[0.14em] text-accent2 uppercase">
          LIBRARIAN // OPERATIONS DESK
        </div>
        <h1 className="text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.03em] text-white">
          Welcome to <span className="text-accent">Librarian Home</span>
        </h1>
        <p className="mt-2 max-w-[620px] text-[0.88rem] leading-relaxed text-tl/85">
          Manage the Iloilo City Public Library catalog, book inventory, issued library cards,
          circulation returns, and community announcements directly on Supabase.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Catalog Books", value: stats?.total_books ?? "—" },
            { label: "Available Copies", value: stats?.available_books ?? "—" },
            { label: "Active Members", value: stats?.total_users ?? "—" },
            { label: "Pending Requests", value: stats?.pending_requests ?? "—" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/8 bg-bg1/60 px-4 py-3"
            >
              <div className="font-mono text-[0.68rem] uppercase tracking-wider text-white/45">
                {item.label}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-white">
                {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_MODULES.map(({ href, label, desc, icon: Icon }, idx) => (
          <motion.div
            key={href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: idx * 0.03 }}
          >
            <Link
              href={href}
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-card-glass p-5 transition duration-200 hover:-translate-y-1 hover:border-accent/35 hover:bg-card-glass-hover"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/20 bg-accent/12 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-white/35 transition group-hover:text-accent" />
              </div>
              <h2 className="mb-1 text-[0.95rem] font-bold text-white">{label}</h2>
              <p className="text-[0.8rem] leading-relaxed text-tl/75">{desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </StaffShell>
  );
}
