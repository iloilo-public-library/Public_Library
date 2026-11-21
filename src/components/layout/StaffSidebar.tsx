"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  ChevronDown,
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
  UserCheck,
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

const ADMIN_MANAGEMENT_BOOK: AdminNavLink = {
  href: "/admin/books",
  label: "Book Management",
  icon: BookOpen,
};

const ADMIN_MANAGEMENT_LOWER: AdminNavLink[] = [
  { href: "/admin/calendar", label: "Event Calendar", icon: CalendarDays },
  { href: "/admin/account-requests", label: "Account Requests", icon: UserCheck },
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
  { label: "Event Calendar", href: "/admin/calendar", parent: "Management" },
  { label: "Account Requests", href: "/admin/account-requests", parent: "Management" },
  { label: "System Settings", href: "/system-settings", parent: null },
  { label: "Account settings", href: "/admin-settings", parent: "Admin" },
];

const LIBRARIAN_NAV: NavItem[] = [
  { href: "/librarian/home", label: "Home", icon: Home, section: "Overview" },
  { href: "/librarian/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { href: "/librarian/inventory", label: "Inventory Status", icon: Package, section: "Library" },
  { href: "/librarian/books", label: "Book Management", icon: BookOpen, section: "Library" },
  { href: "/librarian/library-cards", label: "Library Cards", icon: CreditCard, section: "Library" },
  { href: "/librarian/records-returns", label: "Records & Returns", icon: RotateCcw, section: "Library" },
  { href: "/librarian/users", label: "User Management", icon: Users, section: "Accounts" },
  { href: "/librarian/account-requests", label: "Renewal Requests", icon: UserCheck, section: "Accounts" },
  { href: "/librarian/calendar", label: "Calendar Events", icon: CalendarDays, section: "Community" },
  { href: "/librarian/announcements", label: "Announcements", icon: Megaphone, section: "Community" },
  { href: "/librarian/settings", label: "Librarian Settings", icon: Settings, section: "Account" },
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
  const isAdmin = role === "admin";

  const initialOpenGroup = useMemo(() => {
    for (const grp of ADMIN_MANAGEMENT_GROUPS) {
      if (grp.children.some((c) => pathname === c.href)) return grp.id;
    }
    return null;
  }, [pathname]);

  const [openGroup, setOpenGroup] = useState<string | null>(initialOpenGroup);
  const activeOpenGroup = openGroup ?? initialOpenGroup;

  const filteredLibrarianItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return LIBRARIAN_NAV;
    return LIBRARIAN_NAV.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.section.toLowerCase().includes(q)
    );
  }, [search]);

  const librarianSections = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of filteredLibrarianItems) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return Array.from(map.entries());
  }, [filteredLibrarianItems]);

  const filteredAdminSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return ADMIN_SEARCH_INDEX.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.parent && item.parent.toLowerCase().includes(q))
    );
  }, [search]);

  const renderAdminLink = (item: AdminNavLink, isCompact: boolean, isMobile: boolean) => {
    const Icon = item.icon;
    const isActive = pathname === item.href;
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
        {!isCompact && <span className="truncate">{item.label}</span>}
      </Link>
    );

    return isCompact ? (
      <LibraryTooltip key={item.href} label={item.label} side="right">
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
            href={isAdmin ? "/admin/home" : "/librarian/dashboard"}
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
                  {isAdmin ? "Iloilo City Library" : "Iloilo Library"}
                </div>
                <div className="text-[0.65rem] text-accent/55">
                  {isAdmin ? "Admin Panel" : "Librarian Portal"}
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
          <div className="relative px-3 pb-2 pt-3">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-white/35" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAdmin ? "Search for..." : "Quick search..."}
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

            {isAdmin && search.trim().length > 0 && (
              <div className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-accent/15 bg-sidebar-deep shadow-lg">
                {filteredAdminSearch.length === 0 ? (
                  <div className="px-3 py-2.5 text-center text-xs text-white/40">No matches</div>
                ) : (
                  filteredAdminSearch.map((item) => (
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

                {renderAdminLink(ADMIN_MANAGEMENT_BOOK, isCompact, isMobile)}

                <div className="my-2 h-px bg-accent/10" />

                {ADMIN_MANAGEMENT_LOWER.map((item) => renderAdminLink(item, isCompact, isMobile))}
              </div>
            </div>
          </nav>
        ) : (
          <nav className="flex-1 overflow-y-auto px-2.5 py-2">
            {librarianSections.map(([sectionName, items]) => (
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
        )}

        {/* Footer */}
        {isAdmin ? (
          <div className="shrink-0 space-y-1.5 border-t border-accent/8 p-2.5">
            <LibraryTooltip label="System Settings" side="right" disabled={!isCompact}>
              <Link
                href="/system-settings"
                onClick={isMobile ? onCloseMobile : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[0.82rem] font-medium transition",
                  isCompact && "justify-center px-0",
                  pathname === "/system-settings"
                    ? "bg-accent/15 text-accent"
                    : "text-white/65 hover:bg-white/6 hover:text-white"
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                {!isCompact && <span className="truncate">System Settings</span>}
              </Link>
            </LibraryTooltip>

            <div
              className={cn(
                "flex items-center gap-2 rounded-[10px] border border-white/8 bg-white/[0.03] px-2 py-1.5",
                isCompact && "justify-center border-0 bg-transparent px-0 py-1"
              )}
            >
              <LibraryTooltip label="Account settings" side="right" disabled={!isCompact}>
                <Link
                  href="/admin-settings"
                  onClick={isMobile ? onCloseMobile : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2.5",
                    isCompact && "flex-none justify-center"
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

              {!isCompact && (
                <LibraryTooltip label="Logout" side="right">
                  <a
                    href="/logout"
                    aria-label="Logout"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-danger/20 bg-danger/10 text-danger/80 transition hover:bg-danger/20 hover:text-danger"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </a>
                </LibraryTooltip>
              )}
            </div>
          </div>
        ) : (
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
