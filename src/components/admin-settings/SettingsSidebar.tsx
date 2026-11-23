"use client";

import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  LayoutGrid,
  LogOut,
  Palette,
  Shield,
  User,
  X,
} from "lucide-react";
import type { SectionId } from "./types";

interface SettingsSidebarProps {
  activeSection: SectionId;
  onSelectSection: (section: SectionId) => void;
  initials: string;
  fullname: string;
  email: string;
  showSecurityBadge: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigateAway: (href: string) => void;
}

const GENERAL_ITEMS: { id: SectionId; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "personal", label: "Personal Details", icon: User },
  { id: "security", label: "Password & Security", icon: Shield },
];

export function SettingsSidebar({
  activeSection,
  onSelectSection,
  initials,
  fullname,
  email,
  showSecurityBadge,
  mobileOpen,
  onCloseMobile,
  onNavigateAway,
}: SettingsSidebarProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const onCloseMobileRef = useRef(onCloseMobile);
  onCloseMobileRef.current = onCloseMobile;

  // Escape key & focus trap when mobile drawer is open
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

  const handleItemClick = (section: SectionId) => {
    onSelectSection(section);
    if (mobileOpen) onCloseMobile();
  };

  const renderSidebarBody = (isMobileDrawer: boolean) => (
    <div
      className="flex h-full flex-col"
      style={{
        backgroundColor: "var(--as-sidebar-bg)",
        borderRight: "1px solid var(--as-border)",
      }}
    >
      {/* Back to Home */}
      <div
        className="flex shrink-0 items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--as-border)" }}
      >
        <a
          href="/admin/home"
          onClick={(e) => {
            e.preventDefault();
            onNavigateAway("/admin/home");
          }}
          className="inline-flex min-h-[44px] items-center gap-2.5 text-[0.82rem] font-semibold transition hover:opacity-90"
          style={{ color: "var(--as-text-muted)" }}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: "rgba(var(--accent-rgb), 0.1)",
              border: "1px solid rgba(var(--accent-rgb), 0.18)",
              color: "var(--accent)",
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span>Back to Home</span>
        </a>

        {isMobileDrawer && (
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onCloseMobile}
            aria-label="Close settings menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg transition cursor-pointer"
            style={{
              color: "var(--as-text-secondary)",
              border: "1px solid var(--as-border)",
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Scrollable middle: Profile + Nav */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Block */}
        <div
          className="flex flex-col items-center px-5 pb-5 pt-6"
          style={{ borderBottom: "1px solid var(--as-border)" }}
        >
          <div
            className="notranslate mb-3.5 flex h-[78px] w-[78px] items-center justify-center rounded-full text-[1.65rem] font-bold text-white shadow-[0_6px_24px_rgba(0,0,0,0.35)]"
            style={{
              background: "linear-gradient(135deg, var(--accent), #5a8ab0)",
              border: "3px solid rgba(255, 255, 255, 0.15)",
            }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div
            className="notranslate mb-1 text-center text-[0.98rem] font-bold"
            style={{ color: "var(--as-text-primary)" }}
          >
            {fullname}
          </div>
          <div
            className="notranslate mb-3 max-w-[220px] truncate text-center text-[0.76rem]"
            style={{ color: "var(--as-text-muted)" }}
            title={email}
          >
            {email}
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-[3px] text-[0.68rem] font-bold uppercase tracking-[0.08em]"
            style={{
              backgroundColor: "var(--as-gold-bg)",
              border: "1px solid var(--as-gold-border)",
              color: "var(--as-gold-text)",
            }}
          >
            <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            Administrator
          </span>
        </div>

        {/* Navigation */}
        <nav aria-label="Settings" className="px-3 py-3.5">
          <div
            className="px-2.5 pb-1.5 pt-2 text-[0.62rem] font-bold uppercase tracking-[0.12em]"
            style={{ color: "var(--as-text-faint)" }}
          >
            General
          </div>
          <div className="space-y-0.5">
            {GENERAL_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    handleItemClick(id);
                  }}
                  className="flex min-h-[44px] items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-[0.86rem] transition"
                  style={{
                    backgroundColor: isActive ? "var(--as-active-bg)" : "transparent",
                    color: isActive ? "var(--accent)" : "var(--as-text-secondary)",
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                  {id === "security" && showSecurityBadge && (
                    <span
                      className="ml-auto rounded-full px-2 py-[1px] text-[0.65rem] font-bold"
                      style={{
                        backgroundColor: "rgba(var(--danger-rgb), 0.2)",
                        color: "var(--danger)",
                      }}
                      aria-label="Multi-factor authentication recommended"
                      title="Enable OTP or PIN for extra security"
                    >
                      !
                    </span>
                  )}
                </a>
              );
            })}
          </div>

          <div
            className="mt-2.5 px-2.5 pb-1.5 pt-2 text-[0.62rem] font-bold uppercase tracking-[0.12em]"
            style={{ color: "var(--as-text-faint)" }}
          >
            Preferences
          </div>
          <div className="space-y-0.5">
            <a
              href="#appearance"
              aria-current={activeSection === "appearance" ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                handleItemClick("appearance");
              }}
              className="flex min-h-[44px] items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-[0.86rem] transition"
              style={{
                backgroundColor:
                  activeSection === "appearance" ? "var(--as-active-bg)" : "transparent",
                color:
                  activeSection === "appearance"
                    ? "var(--accent)"
                    : "var(--as-text-secondary)",
                fontWeight: activeSection === "appearance" ? 600 : 500,
              }}
            >
              <Palette className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="truncate">Appearance</span>
            </a>
          </div>
        </nav>
      </div>

      {/* Pinned Sign Out */}
      <div
        className="shrink-0 px-3 pb-5 pt-3"
        style={{ borderTop: "1px solid var(--as-border)" }}
      >
        <a
          href="/logout"
          onClick={(e) => {
            e.preventDefault();
            onNavigateAway("/logout");
          }}
          className="flex min-h-[44px] items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-[0.86rem] font-medium transition hover:bg-danger/10"
          style={{ color: "var(--danger)" }}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span>Sign Out</span>
        </a>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Left Sidebar (>= 1024px) */}
      <aside className="hidden h-full w-[280px] shrink-0 lg:block">
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile / Tablet Slide-in Drawer (< 1024px) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[200] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Settings navigation"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            className="fixed inset-y-0 left-0 z-[201] w-[280px] max-w-[85vw] shadow-2xl"
          >
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
}
