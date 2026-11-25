"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { swrPrivateConfig } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types/library";
import type { AdminProfileResponse } from "@/components/admin-settings/types";

interface AdminNavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: { href: string; label: string }[];
}

interface AdminNavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_MAIN_ITEMS: AdminNavLink[] = [
  { href: "/admin/home", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/announcements", label: "Announcement", icon: Megaphone },
];

const ADMIN_MANAGEMENT_GROUPS: AdminNavGroup[] = [
  {
    id: "user_mgmt",
    label: "User Management",
    icon: Users,
    children: [
      { href: "/admin/admins", label: "Admins" },
      { href: "/admin/librarians", label: "Librarians" },
      { href: "/admin/users", label: "Users / Members" },
    ],
  },
  {
    id: "borrow_mgmt",
    label: "Borrow Management",
    icon: BookMarked,
    children: [
      { href: "/admin/library-cards", label: "Borrowing Form" },
      { href: "/admin/records-returns", label: "Borrow History" },
    ],
  },
];

const ADMIN_MANAGEMENT_BOOK: AdminNavLink[] = [
  {
    href: "/admin/books",
    label: "Book Management",
    icon: BookOpen,
  },
  {
    href: "/admin/inventory",
    label: "Inventory & Conditions",
    icon: Package,
  },
];

const ADMIN_MANAGEMENT_LOWER: AdminNavLink[] = [
  { href: "/admin/calendar", label: "Event Calendar", icon: CalendarDays },
  { href: "/admin/account-requests", label: "Account Requests", icon: UserCheck },
  { href: "/admin/error-logs", label: "Error & Security Logs", icon: AlertTriangle },
];

const ADMIN_SEARCH_INDEX: { label: string; href: string; parent: string | null }[] = [
  { label: "Home", href: "/admin/home", parent: "Main" },
  { label: "Dashboard", href: "/dashboard", parent: "Main" },
  { label: "Announcement", href: "/admin/announcements", parent: "Main" },
  { label: "Admins", href: "/admin/admins", parent: "User Management" },
  { label: "Librarians", href: "/admin/librarians", parent: "User Management" },
  { label: "Users / Members", href: "/admin/users", parent: "User Management" },
  { label: "Borrowing Form", href: "/admin/library-cards", parent: "Borrow Management" },
  { label: "Borrow History", href: "/admin/records-returns", parent: "Borrow Management" },
  { label: "Book Management", href: "/admin/books", parent: "Management" },
  { label: "Inventory & Conditions", href: "/admin/inventory", parent: "Management" },
  { label: "Event Calendar", href: "/admin/calendar", parent: "Management" },
  { label: "Account Requests", href: "/admin/account-requests", parent: "Management" },
  { label: "Error & Security Logs", href: "/admin/error-logs", parent: "Management" },
  { label: "System Settings", href: "/system-settings", parent: null },
  { label: "Account settings", href: "/admin-settings", parent: "Admin" },
];

const LIBRARIAN_MAIN_ITEMS: AdminNavLink[] = [
  { href: "/librarian/home", label: "Home", icon: Home },
  { href: "/librarian/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/librarian/announcements", label: "Announcement", icon: Megaphone },
];

const LIBRARIAN_MANAGEMENT_GROUPS: AdminNavGroup[] = [
  {
    id: "lib_borrow_mgmt",
    label: "Borrow Management",
    icon: BookMarked,
    children: [
      { href: "/librarian/library-cards", label: "Borrowing Form" },
      { href: "/librarian/records-returns", label: "Borrow History" },
    ],
  },
];

const LIBRARIAN_MANAGEMENT_DIRECT: AdminNavLink[] = [
  { href: "/librarian/users", label: "User Management", icon: Users },
  { href: "/librarian/books", label: "Book Management", icon: BookOpen },
];

const LIBRARIAN_MANAGEMENT_LOWER: AdminNavLink[] = [
  { href: "/librarian/calendar", label: "Event Calendar", icon: CalendarDays },
  { href: "/librarian/account-requests", label: "Account Requests", icon: UserCheck },
];

const LIBRARIAN_SEARCH_INDEX: { label: string; href: string; parent: string | null }[] = [
  { label: "Home", href: "/librarian/home", parent: "Main" },
  { label: "Dashboard", href: "/librarian/dashboard", parent: "Main" },
  { label: "Announcement", href: "/librarian/announcements", parent: "Main" },
  { label: "Borrowing Form", href: "/librarian/library-cards", parent: "Borrow Management" },
  { label: "Borrow History", href: "/librarian/records-returns", parent: "Borrow Management" },
  { label: "User Management", href: "/librarian/users", parent: "Management" },
  { label: "Book Management", href: "/librarian/books", parent: "Management" },
  { label: "Event Calendar", href: "/librarian/calendar", parent: "Management" },
  { label: "Account Requests", href: "/librarian/account-requests", parent: "Management" },
  { label: "Inventory Status", href: "/librarian/inventory", parent: "Management" },
  { label: "Account settings", href: "/librarian/settings", parent: "Librarian" },
];

export const LIBRARIAN_NAV = {
  main: LIBRARIAN_MAIN_ITEMS,
  managementGroups: LIBRARIAN_MANAGEMENT_GROUPS,
  managementDirect: LIBRARIAN_MANAGEMENT_DIRECT,
  managementLower: LIBRARIAN_MANAGEMENT_LOWER,
  searchIndex: LIBRARIAN_SEARCH_INDEX,
};

interface StaffSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  role?: "admin" | "librarian";
}

interface AccountRequestRow {
  status?: string;
  request_type?: string;
}

interface AccountRequestsResponse {
  rows?: AccountRequestRow[];
}

export function StaffSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  role = "admin",
}: StaffSidebarProps) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const isAdmin = role === "admin";

  const drawerRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const onCloseMobileRef = useRef(onCloseMobile);
  onCloseMobileRef.current = onCloseMobile;

  // Focus trap, Esc key, and focus restoration for the mobile drawer
  useEffect(() => {
    if (!mobileOpen) return;

    const prevFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseMobileRef.current();
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      prevFocused?.focus();
    };
  }, [mobileOpen]);

  const { data: stats } = useSWR<DashboardStats>(
    isAdmin ? "/api/dashboard/stats" : null,
    swrPrivateConfig
  );
  const { data: librarianRequestsRes } = useSWR<AccountRequestsResponse>(
    !isAdmin ? "/api/admin/data?resource=account_requests" : null,
    swrPrivateConfig
  );
  const { data: profileRes } = useSWR<AdminProfileResponse>(
    !isAdmin ? "/api/admin/data?resource=admin_profile" : null,
    swrPrivateConfig
  );

  const pendingReqCount = useMemo(() => {
    if (isAdmin) return stats?.pending_requests ?? 0;
    const rows = librarianRequestsRes?.rows ?? [];
    return rows.filter(
      (r) =>
        r.status === "pending" &&
        (r.request_type === "renew" || r.request_type === "renewal")
    ).length;
  }, [isAdmin, stats?.pending_requests, librarianRequestsRes?.rows]);

  const pendingBadgeText = pendingReqCount > 9 ? "9+" : String(pendingReqCount);

  const librarianDisplay = useMemo(() => {
    const p = profileRes?.profile;
    const rawFirst = p?.firstname && !p.firstname.startsWith("gAAAAAB") ? p.firstname.trim() : "";
    const rawLast = p?.lastname && !p.lastname.startsWith("gAAAAAB") ? p.lastname.trim() : "";
    const label = rawLast ? `Librarian ${rawLast}` : "Librarian";
    const initials =
      rawFirst || rawLast
        ? `${rawFirst[0] ?? ""}${rawLast[0] ?? ""}`.toUpperCase() || "LB"
        : "LB";
    return { label, initials };
  }, [profileRes?.profile]);

  const initialOpenGroup = useMemo(() => {
    const groups = isAdmin ? ADMIN_MANAGEMENT_GROUPS : LIBRARIAN_MANAGEMENT_GROUPS;
    for (const grp of groups) {
      if (grp.children.some((c) => pathname === c.href)) return grp.id;
    }
    return null;
  }, [isAdmin, pathname]);

  const [openGroup, setOpenGroup] = useState<string | null>(initialOpenGroup);
  const activeOpenGroup = openGroup ?? initialOpenGroup;

  const filteredSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const index = isAdmin ? ADMIN_SEARCH_INDEX : LIBRARIAN_SEARCH_INDEX;
    return index.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.parent && item.parent.toLowerCase().includes(q))
    );
  }, [isAdmin, search]);

  const renderAdminLink = (item: AdminNavLink, isCompact: boolean, isMobile: boolean) => {
    const Icon = item.icon;
    const isActive = pathname === item.href;
    const isAccountRequests =
      item.href === "/admin/account-requests" || item.href === "/librarian/account-requests";
    const showBadge = isAccountRequests && pendingReqCount > 0;
    const tooltipLabel = showBadge ? `${item.label} (${pendingBadgeText})` : item.label;

    const linkEl = (
      <Link
        key={item.href}
        href={item.href}
        onClick={isMobile ? onCloseMobile : undefined}
        aria-label={isCompact ? tooltipLabel : undefined}
        className={cn(
          "relative flex min-h-[44px] items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[0.82rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          isCompact && "justify-center px-0 py-2.5",
          isActive
            ? "bg-accent/15 text-accent"
            : "text-white/65 hover:bg-white/6 hover:text-white"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!isCompact && <span className="flex-1 truncate">{item.label}</span>}
        {!isCompact && showBadge && (
          <span className="rounded bg-danger px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
            {pendingBadgeText}
          </span>
        )}
        {isCompact && showBadge && (
          <span
            className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[0.55rem] font-bold leading-none text-white"
            aria-hidden="true"
          >
            {pendingBadgeText}
          </span>
        )}
      </Link>
    );

    return isCompact ? (
      <LibraryTooltip key={item.href} label={tooltipLabel} side="right">
        {linkEl}
      </LibraryTooltip>
    ) : (
      linkEl
    );
  };

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
            href={isAdmin ? "/admin/home" : "/librarian/home"}
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
                  Iloilo City Library
                </div>
                <div className="text-[0.65rem] text-accent/55">
                  {isAdmin ? "Admin Panel" : "Librarian Panel"}
                </div>
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
              ref={closeBtnRef}
              type="button"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Search */}
        {!isCompact ? (
          <div className="relative px-3 pb-2 pt-3">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-white/35" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for..."
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

            {search.trim().length > 0 && (
              <div className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-accent/15 bg-sidebar-deep shadow-lg">
                {filteredSearch.length === 0 ? (
                  <div className="px-3 py-2.5 text-center text-xs text-white/40">No matches</div>
                ) : (
                  filteredSearch.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setSearch("");
                        if (isMobile) onCloseMobile();
                      }}
                      className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-xs text-white/75 transition last:border-b-0 hover:bg-accent/12 hover:text-white"
                    >
                      <span>{item.label}</span>
                      {item.parent && (
                        <span className="text-[0.65rem] text-white/35">{item.parent}</span>
                      )}
                    </Link>
                  ))
                )}
              </div>
            )}
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
        {isAdmin ? (
          <nav className="flex-1 overflow-y-auto px-2.5 py-2">
            {/* Main */}
            <div className="mb-3">
              {!isCompact && (
                <div className="mb-1 px-2.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-accent/45">
                  Main
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {ADMIN_MAIN_ITEMS.map((item) => renderAdminLink(item, isCompact, isMobile))}
              </div>
            </div>

            {/* Management */}
            <div className="mb-3">
              {!isCompact && (
                <div className="mb-1 px-2.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-accent/45">
                  Management
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {ADMIN_MANAGEMENT_GROUPS.map((group) => {
                  const GroupIcon = group.icon;
                  const isOpen = activeOpenGroup === group.id;
                  const hasActiveChild = group.children.some((c) => pathname === c.href);

                  const btnEl = (
                    <button
                      type="button"
                      onClick={() => {
                        if (isCompact) {
                          onToggleCollapse();
                          setOpenGroup(group.id);
                          return;
                        }
                        setOpenGroup((prev) => (prev === group.id ? "" : group.id));
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[0.82rem] font-medium transition cursor-pointer",
                        isCompact && "justify-center px-0 py-2.5",
                        hasActiveChild
                          ? "bg-accent/15 text-accent"
                          : "text-white/65 hover:bg-white/6 hover:text-white"
                      )}
                    >
                      <GroupIcon className="h-4 w-4 shrink-0" />
                      {!isCompact && (
                        <>
                          <span className="flex-1 truncate text-left">{group.label}</span>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-white/40 transition-transform",
                              isOpen && "rotate-180"
                            )}
                          />
                        </>
                      )}
                    </button>
                  );

                  return (
                    <div key={group.id}>
                      {isCompact ? (
                        <LibraryTooltip label={group.label} side="right">
                          {btnEl}
                        </LibraryTooltip>
                      ) : (
                        btnEl
                      )}

                      {!isCompact && isOpen && (
                        <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-accent/15 pl-2.5">
                          {group.children.map((child) => {
                            const childActive = pathname === child.href;
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={isMobile ? onCloseMobile : undefined}
                                className={cn(
                                  "rounded-lg px-2.5 py-1.5 text-[0.78rem] font-medium transition",
                                  childActive
                                    ? "bg-accent/15 text-accent"
                                    : "text-white/60 hover:bg-white/6 hover:text-white"
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {ADMIN_MANAGEMENT_BOOK.map((item) => renderAdminLink(item, isCompact, isMobile))}

                <div className="my-2 h-px bg-accent/10" />

                {ADMIN_MANAGEMENT_LOWER.map((item) => renderAdminLink(item, isCompact, isMobile))}
              </div>
            </div>
          </nav>
        ) : (
          <nav className="flex-1 overflow-y-auto px-2.5 py-2" aria-label="Librarian navigation">
            {/* Main */}
            <div className="mb-3">
              {!isCompact && (
                <div className="mb-1 px-2.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-accent/45">
                  Main
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {LIBRARIAN_MAIN_ITEMS.map((item) => renderAdminLink(item, isCompact, isMobile))}
              </div>
            </div>

            {/* Management */}
            <div className="mb-3">
              {!isCompact && (
                <div className="mb-1 px-2.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-accent/45">
                  Management
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {LIBRARIAN_MANAGEMENT_GROUPS.map((group) => {
                  const GroupIcon = group.icon;
                  const isOpen = activeOpenGroup === group.id;
                  const hasActiveChild = group.children.some((c) => pathname === c.href);

                  const btnEl = (
                    <button
                      type="button"
                      onClick={() => {
                        if (isCompact) {
                          onToggleCollapse();
                          setOpenGroup(group.id);
                          return;
                        }
                        setOpenGroup((prev) => (prev === group.id ? "" : group.id));
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[0.82rem] font-medium transition cursor-pointer",
                        isCompact && "justify-center px-0 py-2.5",
                        hasActiveChild
                          ? "bg-accent/15 text-accent"
                          : "text-white/65 hover:bg-white/6 hover:text-white"
                      )}
                    >
                      <GroupIcon className="h-4 w-4 shrink-0" />
                      {!isCompact && (
                        <>
                          <span className="flex-1 truncate text-left">{group.label}</span>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-white/40 transition-transform",
                              isOpen && "rotate-180"
                            )}
                          />
                        </>
                      )}
                    </button>
                  );

                  return (
                    <div key={group.id}>
                      {isCompact ? (
                        <LibraryTooltip label={group.label} side="right">
                          {btnEl}
                        </LibraryTooltip>
                      ) : (
                        btnEl
                      )}

                      {!isCompact && isOpen && (
                        <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-accent/15 pl-2.5">
                          {group.children.map((child) => {
                            const childActive = pathname === child.href;
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={isMobile ? onCloseMobile : undefined}
                                className={cn(
                                  "rounded-lg px-2.5 py-1.5 text-[0.78rem] font-medium transition",
                                  childActive
                                    ? "bg-accent/15 text-accent"
                                    : "text-white/60 hover:bg-white/6 hover:text-white"
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {LIBRARIAN_MANAGEMENT_DIRECT.map((item) =>
                  renderAdminLink(item, isCompact, isMobile)
                )}

                <div className="my-2 h-px bg-accent/10" />

                {LIBRARIAN_MANAGEMENT_LOWER.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  const showBadge =
                    item.href === "/librarian/account-requests" && pendingReqCount > 0;
                  const linkEl = (
                    <Link
                      key={item.href}
                      href={item.href}
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
                      {!isCompact && <span className="flex-1 truncate">{item.label}</span>}
                      {!isCompact && showBadge && (
                        <span className="rounded bg-danger px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                          {pendingBadgeText}
                        </span>
                      )}
                    </Link>
                  );

                  return isCompact ? (
                    <LibraryTooltip key={item.href} label={item.label} side="right">
                      {linkEl}
                    </LibraryTooltip>
                  ) : (
                    linkEl
                  );
                })}
              </div>
            </div>
          </nav>
        )}

        {/* Footer */}
        {isAdmin ? (
          <div className="shrink-0 space-y-1.5 border-t border-accent/8 p-2.5">
            <LibraryTooltip label="System Settings" side="right" disabled={!isCompact}>
              <Link
                href="/system-settings"
                onClick={isMobile ? onCloseMobile : undefined}
                aria-label={isCompact ? "System Settings" : undefined}
                className={cn(
                  "flex min-h-[44px] items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[0.82rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  isCompact && "w-full justify-center px-0",
                  pathname === "/system-settings"
                    ? "bg-accent/15 text-accent"
                    : "text-white/65 hover:bg-white/6 hover:text-white"
                )}
              >
                <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!isCompact && <span className="truncate">System Settings</span>}
              </Link>
            </LibraryTooltip>

            <div
              className={cn(
                "flex items-center gap-2 rounded-[10px] border border-white/8 bg-white/[0.03] px-2 py-1",
                isCompact && "flex-col justify-center gap-1.5 border-0 bg-transparent px-0 py-1"
              )}
            >
              <LibraryTooltip label="Account settings" side="right" disabled={!isCompact}>
                <Link
                  href="/admin-settings"
                  onClick={isMobile ? onCloseMobile : undefined}
                  aria-label={isCompact ? "Account settings" : undefined}
                  className={cn(
                    "flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    isCompact && "w-11 flex-none justify-center"
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/15 text-[0.72rem] font-bold text-accent">
                    AD
                  </div>
                  {!isCompact && (
                    <div className="min-w-0 truncate leading-tight">
                      <div className="truncate text-[0.8rem] font-semibold text-white">Admin</div>
                      <div className="truncate text-[0.65rem] text-white/45">Account settings</div>
                    </div>
                  )}
                </Link>
              </LibraryTooltip>

              <LibraryTooltip label="Logout" side="right">
                <a
                  href="/logout"
                  aria-label="Logout"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-danger/20 bg-danger/10 text-danger/80 transition hover:bg-danger/20 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </a>
              </LibraryTooltip>
            </div>
          </div>
        ) : (
          <div className="shrink-0 space-y-1.5 border-t border-accent/8 p-2.5">
            <div
              className={cn(
                "flex items-center gap-2 rounded-[10px] border border-white/8 bg-white/[0.03] px-2 py-1",
                isCompact && "flex-col justify-center gap-1.5 border-0 bg-transparent px-0 py-1"
              )}
            >
              <LibraryTooltip label="Account settings" side="right" disabled={!isCompact}>
                <Link
                  href="/librarian/settings"
                  onClick={isMobile ? onCloseMobile : undefined}
                  aria-label={isCompact ? "Account settings" : undefined}
                  className={cn(
                    "flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    isCompact && "w-11 flex-none justify-center"
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2 text-[0.72rem] font-bold text-white">
                    {librarianDisplay.initials}
                  </div>
                  {!isCompact && (
                    <div className="min-w-0 truncate leading-tight">
                      <div className="truncate text-[0.8rem] font-semibold text-white">
                        {librarianDisplay.label}
                      </div>
                      <div className="truncate text-[0.65rem] text-white/45">Account settings</div>
                    </div>
                  )}
                </Link>
              </LibraryTooltip>

              <LibraryTooltip label="Logout" side="right">
                <a
                  href="/logout"
                  aria-label="Logout"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-danger/20 bg-danger/10 text-danger/80 transition hover:bg-danger/20 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </a>
              </LibraryTooltip>
            </div>
          </div>
        )}
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
          <div role="dialog" aria-modal="true" aria-label="Staff navigation">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              onClick={onCloseMobile}
              aria-hidden="true"
              className="fixed inset-0 z-[1190] bg-black/65 backdrop-blur-xs lg:hidden"
            />
            <motion.aside
              ref={drawerRef}
              initial={{ x: prefersReducedMotion ? 0 : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: prefersReducedMotion ? 0 : "-100%" }}
              transition={{ type: "tween", duration: prefersReducedMotion ? 0 : 0.25 }}
              className="fixed inset-y-0 left-0 z-[1200] w-[260px] max-w-[85vw] lg:hidden"
            >
              {sidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
