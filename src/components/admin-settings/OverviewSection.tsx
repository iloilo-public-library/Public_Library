"use client";

import {
  AtSign,
  BookOpen,
  Calendar,
  CheckCircle2,
  IdCard,
  Palette,
  Phone,
  Shield,
  User,
} from "lucide-react";
import { LoginActivityCard } from "./LoginActivityCard";
import type { AdminProfile, LoginSession, SectionId } from "./types";

interface OverviewSectionProps {
  profile: AdminProfile | undefined;
  displayName: string;
  isLoading: boolean;
  adminSince: string;
  sessions: LoginSession[];
  onSelectSection: (section: SectionId) => void;
  role?: "admin" | "librarian";
  phone?: string;
}

export function OverviewSection({
  profile,
  displayName,
  isLoading,
  adminSince,
  sessions,
  onSelectSection,
  role = "admin",
  phone,
}: OverviewSectionProps) {
  const isLibrarian = role === "librarian";
  const statusLabel = profile
    ? profile.is_active && profile.is_approved
      ? "Active & Verified"
      : !profile.is_approved
      ? "Pending approval"
      : "Deactivated"
    : isLoading
    ? "Loading..."
    : "—";

  return (
    <section id="overview" aria-labelledby="overview-heading">
      <div className="mb-6">
        <h2
          id="overview-heading"
          className="mb-[5px] text-[1.45rem] font-bold tracking-[-0.03em]"
          style={{ color: "var(--as-text-primary)" }}
        >
          Good to see you, <span style={{ color: "var(--accent)" }}>{displayName}</span> 👋
        </h2>
        <p className="text-[0.85rem]" style={{ color: "var(--as-text-secondary)" }}>
          Manage everything about your account from here.
        </p>
      </div>

      {/* Three Quick-Link Cards */}
      <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <a
          href="#personal"
          onClick={(e) => {
            e.preventDefault();
            onSelectSection("personal");
          }}
          className="flex min-h-[44px] flex-col items-start gap-2.5 rounded-[14px] px-4 py-[18px] transition hover:border-accent/40"
          style={{
            backgroundColor: "var(--as-card-bg)",
            border: "1px solid var(--as-border)",
          }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{
              backgroundColor: "rgba(var(--accent-rgb), 0.12)",
              color: "var(--accent)",
            }}
          >
            <User className="h-4 w-4" aria-hidden="true" />
          </span>
          <span
            className="text-[0.82rem] font-semibold"
            style={{ color: "var(--as-text-primary)" }}
          >
            Personal Details
          </span>
        </a>

        <a
          href="#security"
          onClick={(e) => {
            e.preventDefault();
            onSelectSection("security");
          }}
          className="flex min-h-[44px] flex-col items-start gap-2.5 rounded-[14px] px-4 py-[18px] transition hover:border-danger/40"
          style={{
            backgroundColor: "var(--as-card-bg)",
            border: "1px solid var(--as-border)",
          }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{
              backgroundColor: "rgba(var(--danger-rgb), 0.12)",
              color: "var(--danger)",
            }}
          >
            <Shield className="h-4 w-4" aria-hidden="true" />
          </span>
          <span
            className="text-[0.82rem] font-semibold"
            style={{ color: "var(--as-text-primary)" }}
          >
            Password &amp; Security
          </span>
        </a>

        <a
          href="#appearance"
          onClick={(e) => {
            e.preventDefault();
            onSelectSection("appearance");
          }}
          className="flex min-h-[44px] flex-col items-start gap-2.5 rounded-[14px] px-4 py-[18px] transition hover:border-accent2/40"
          style={{
            backgroundColor: "var(--as-card-bg)",
            border: "1px solid var(--as-border)",
          }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{
              backgroundColor: "rgba(var(--accent2-rgb), 0.12)",
              color: "var(--accent2)",
            }}
          >
            <Palette className="h-4 w-4" aria-hidden="true" />
          </span>
          <span
            className="text-[0.82rem] font-semibold"
            style={{ color: "var(--as-text-primary)" }}
          >
            Appearance
          </span>
        </a>
      </div>

      {/* ACCOUNT SUMMARY Card */}
      <div
        className="mb-[18px] overflow-hidden rounded-[16px]"
        style={{
          backgroundColor: "var(--as-card-bg)",
          border: "1px solid var(--as-border)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 pb-3 pt-3.5"
          style={{ borderBottom: "1px solid var(--as-border)" }}
        >
          <span
            className="flex items-center gap-2 text-[0.78rem] font-bold uppercase tracking-[0.07em]"
            style={{ color: "var(--accent)" }}
          >
            <IdCard className="h-4 w-4" aria-hidden="true" />
            Account Summary
          </span>
          <button
            type="button"
            onClick={() => onSelectSection("personal")}
            className="inline-flex min-h-[36px] items-center rounded-lg px-3 py-1 text-[0.75rem] font-semibold transition cursor-pointer"
            style={{
              color: "var(--accent)",
              backgroundColor: "rgba(var(--accent-rgb), 0.1)",
              border: "1px solid rgba(var(--accent-rgb), 0.2)",
            }}
          >
            Edit
          </button>
        </div>

        <div>
          {/* Librarian-only: Full Name + Phone Number */}
          {isLibrarian && (
            <>
              <div
                className="flex items-center justify-between gap-4 px-5 py-3.5"
                style={{ borderBottom: "1px solid var(--as-border-subtle)" }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-[13px]">
                  <span
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                    style={{
                      backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                      color: "var(--accent)",
                    }}
                  >
                    <User className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div
                      className="mb-0.5 text-[0.88rem] font-semibold"
                      style={{ color: "var(--as-text-primary)" }}
                    >
                      Full Name
                    </div>
                    <div
                      className="notranslate truncate text-[0.75rem]"
                      style={{ color: "var(--as-text-muted)" }}
                    >
                      {isLoading ? "Loading..." : displayName}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="flex items-center justify-between gap-4 px-5 py-3.5"
                style={{ borderBottom: "1px solid var(--as-border-subtle)" }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-[13px]">
                  <span
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                    style={{
                      backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                      color: "var(--accent)",
                    }}
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div
                      className="mb-0.5 text-[0.88rem] font-semibold"
                      style={{ color: "var(--as-text-primary)" }}
                    >
                      Phone Number
                    </div>
                    <div
                      className="notranslate truncate text-[0.75rem]"
                      style={{ color: "var(--as-text-muted)" }}
                    >
                      {isLoading ? "Loading..." : phone || "—"}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Username / Email */}
          <div
            className="flex items-center justify-between gap-4 px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--as-border-subtle)" }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-[13px]">
              <span
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                  color: "var(--accent)",
                }}
              >
                <AtSign className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div
                  className="mb-0.5 text-[0.88rem] font-semibold"
                  style={{ color: "var(--as-text-primary)" }}
                >
                  Username / Email
                </div>
                <div
                  className="truncate text-[0.75rem]"
                  style={{ color: "var(--as-text-muted)" }}
                >
                  {isLoading ? "Loading..." : profile?.email || "Not signed in"}
                </div>
              </div>
            </div>
          </div>

          {/* Librarian-only: Role */}
          {isLibrarian && (
            <div
              className="flex items-center justify-between gap-4 px-5 py-3.5"
              style={{ borderBottom: "1px solid var(--as-border-subtle)" }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-[13px]">
                <span
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                  style={{
                    backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                    color: "var(--accent)",
                  }}
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div
                    className="mb-0.5 text-[0.88rem] font-semibold"
                    style={{ color: "var(--as-text-primary)" }}
                  >
                    Role
                  </div>
                  <div
                    className="text-[0.75rem]"
                    style={{ color: "var(--as-text-muted)" }}
                  >
                    Librarian
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account Status */}
          <div
            className="flex items-center justify-between gap-4 px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--as-border-subtle)" }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-[13px]">
              <span
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor: "rgba(var(--accent2-rgb), 0.1)",
                  color: "var(--accent2)",
                }}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div
                  className="mb-0.5 text-[0.88rem] font-semibold"
                  style={{ color: "var(--as-text-primary)" }}
                >
                  Account Status
                </div>
                <div
                  className="text-[0.75rem]"
                  style={{ color: "var(--as-text-muted)" }}
                >
                  {statusLabel}
                </div>
              </div>
            </div>
            <span
              className="shrink-0 whitespace-nowrap text-[0.82rem] font-medium"
              style={{
                color: profile?.is_active ? "var(--accent2)" : "var(--danger)",
              }}
            >
              ● {profile?.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Admin Since / Librarian Since */}
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex min-w-0 flex-1 items-center gap-[13px]">
              <span
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor: "var(--as-gold-bg)",
                  color: "var(--gold)",
                }}
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div
                  className="mb-0.5 text-[0.88rem] font-semibold"
                  style={{ color: "var(--as-text-primary)" }}
                >
                  {isLibrarian ? "Librarian Since" : "Admin Since"}
                </div>
                <div
                  className="text-[0.75rem]"
                  style={{ color: "var(--as-text-muted)" }}
                >
                  {adminSince}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LOGIN ACTIVITY Card */}
      <LoginActivityCard sessions={sessions} variant={isLibrarian ? "recent" : "full"} />
    </section>
  );
}
