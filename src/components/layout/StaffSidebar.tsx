"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Sliders,
  UserCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section: string;
}

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/home", label: "Home", icon: Home, section: "Overview" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { href: "/admin/inventory", label: "Inventory Status", icon: Package, section: "Library" },
  { href: "/admin/books", label: "Book Management", icon: BookOpen, section: "Library" },
  { href: "/admin/library-cards", label: "Library Cards", icon: CreditCard, section: "Library" },
  { href: "/admin/records-returns", label: "Records & Returns", icon: RotateCcw, section: "Library" },
  { href: "/admin/users", label: "User Management", icon: Users, section: "Accounts" },
  { href: "/admin/librarians", label: "Librarians", icon: UserCog, section: "Accounts" },
  { href: "/admin/admins", label: "Admins", icon: Shield, section: "Accounts" },
  { href: "/admin/account-requests", label: "Account Requests", icon: UserCheck, section: "Accounts" },
  { href: "/admin/calendar", label: "Calendar Events", icon: CalendarDays, section: "Community" },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone, section: "Community" },
  { href: "/admin/error-logs", label: "Error Logs", icon: AlertTriangle, section: "System" },
  { href: "/system-settings", label: "System Settings", icon: Sliders, section: "System" },
  { href: "/admin-settings", label: "Admin Settings", icon: Settings, section: "System" },
];

interface StaffSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  role?: "admin" | "librarian";
}

export function StaffSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  role = "admin",
}: StaffSidebarProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ADMIN_NAV;
    return ADMIN_NAV.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.section.toLowerCase().includes(q)
    );
  }, [search]);

  const sections = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return Array.from(map.entries());
  }, [filteredItems]);

  const sidebarContent = (isMobile: boolean) => {
    const isCompact = !isMobile && collapsed;

    return (
      <div className="flex h-full flex-col bg-sidebar border-r border-accent/10">
        {/* Header */}
        <div
          className={cn(
            "flex min-h-[64px] shrink-0 items-center border-b border-accent/8 px-3.5 py-4",
            isCompact ? "justify-center px-0" : "justify-between"
          )}
        >
          <Link
            href={role === "admin" ? "/dashboard" : "/librarian/dashboard"}
            className="flex min-w-0 items-center gap-2.5 overflow-hidden"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-accent to-accent2">
              <img
                src="/images/logo.png"
                alt="Logo"
                className="h-full w-full rounded-lg object-cover"
              />
            </div>
            {!isCompact && (
              <div className="truncate leading-tight">
                <div className="text-[0.82rem] font-bold tracking-[-0.01em] text-white">
                  Iloilo Library
                </div>
                <div className="text-[0.65rem] capitalize text-accent/55">{role} Portal</div>
              </div>
            )}
          </Link>

          {!isMobile && !isCompact && (
            <LibraryTooltip label="Collapse sidebar" side="right">
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-white/8 bg-white/6 text-white/45 transition hover:bg-white/12 hover:text-white cursor-pointer"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </LibraryTooltip>
          )}

          {isMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-white/70 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search */}
        {!isCompact ? (
          <div className="px-3 pb-2 pt-3">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-white/35" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Quick search..."
                className="w-full rounded-lg border border-white/8 bg-sidebar-deep py-1.5 pl-8 pr-7 text-xs text-white placeholder:text-white/35 focus:border-accent/40 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 text-white/40 hover:text-white cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-2">
            <LibraryTooltip label="Expand sidebar" side="right">
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Expand sidebar"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/6 text-white/55 transition hover:bg-white/12 hover:text-white cursor-pointer"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </LibraryTooltip>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-2">
          {sections.map(([sectionName, items]) => (
            <div key={sectionName} className="mb-3">
              {!isCompact && (
                <div className="mb-1 px-2.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-accent/45">
                  {sectionName}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {items.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href;
                  const linkEl = (
                    <Link
                      key={href}
                      href={href}
                      onClick={isMobile ? onCloseMobile : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[0.82rem] font-medium transition",
                        isCompact && "justify-center px-0 py-2.5",
                        isActive
                          ? "bg-accent/15 text-accent"
                          : "text-white/65 hover:bg-white/6 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!isCompact && <span className="truncate">{label}</span>}
                    </Link>
                  );

                  return isCompact ? (
                    <LibraryTooltip key={href} label={label} side="right">
                      {linkEl}
                    </LibraryTooltip>
                  ) : (
                    linkEl
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Logout */}
        <div className="shrink-0 border-t border-accent/8 p-2.5">
          <LibraryTooltip label="Sign Out" side="right" disabled={!isCompact}>
            <a
              href="/logout"
              className={cn(
                "flex items-center gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 px-3 py-2 text-[0.82rem] font-semibold text-danger/85 transition hover:bg-danger/20 hover:text-danger",
                isCompact && "justify-center px-0"
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!isCompact && <span>Log Out</span>}
            </a>
          </LibraryTooltip>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[1100] hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:block",
          collapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile Off-Canvas Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 z-[1190] bg-black/65 backdrop-blur-xs lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-[1200] w-[260px] lg:hidden"
            >
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
