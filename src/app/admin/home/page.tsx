"use client";

import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Package,
  RotateCcw,
  Sliders,
  UserCheck,
  Users,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { swrPrivateConfig } from "@/lib/api";
import type { DashboardStats } from "@/types/library";

const QUICK_MODULES = [
  { href: "/dashboard", label: "Analytics Dashboard", desc: "Live library KPIs and inventory metrics", icon: LayoutDashboard },
  { href: "/admin/inventory", label: "Inventory Status", desc: "Track copies, shelf locations, damaged & lost items", icon: Package },
  { href: "/admin/books", label: "Book Management", desc: "Catalog records, ISBNs, and borrowing eligibility", icon: BookOpen },
  { href: "/admin/library-cards", label: "Library Cards", desc: "Issued member cards, renewals, and expiration dates", icon: CreditCard },
  { href: "/admin/records-returns", label: "Records & Returns", desc: "Circulation return logs and processed items", icon: RotateCcw },
  { href: "/admin/users", label: "User Management", desc: "Patron accounts, approval status, and lock controls", icon: Users },
  { href: "/admin/account-requests", label: "Account Requests", desc: "Review pending registrations and card renewals", icon: UserCheck },
  { href: "/admin/calendar", label: "Calendar Events", desc: "Library programs, workshops, and community schedules", icon: CalendarDays },
  { href: "/admin/announcements", label: "Announcements", desc: "Publish notices and urgent maintenance bulletins", icon: Megaphone },
  { href: "/admin/error-logs", label: "Error & Security Logs", desc: "Inspect API failures, 404 hits, locked accounts, and backup errors", icon: AlertTriangle },
  { href: "/system-settings", label: "System Settings", desc: "Lockdown mode, maintenance gate, and backup logs", icon: Sliders },
];

export default function AdminHomePage() {
  const { data: stats } = useSWR<DashboardStats>("/api/dashboard/stats", swrPrivateConfig);

  return (
    <StaffShell title="Admin Home">
      <div className="mb-8 rounded-[22px] border border-accent/20 bg-card-glass p-6 backdrop-blur-sm md:p-8">
        <div className="mb-2 font-mono text-[0.72rem] tracking-[0.14em] text-accent2 uppercase">
          ADMIN // CONTROL CENTER
        </div>
        <h1 className="text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.03em] text-white">
          Welcome to <span className="text-accent">Admin Home</span>
        </h1>
        <p className="mt-2 max-w-[620px] text-[0.88rem] leading-relaxed text-tl/85">
          Manage the Iloilo City Public Library catalog, member registrations, circulation records,
          and cybersecurity controls directly on Supabase.
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
