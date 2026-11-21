"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Globe,
  Info,
  KeyRound,
  Loader2,
  Mail,
  Palette,
  Phone,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { apiMutate, swrPrivateConfig } from "@/lib/api";

interface AdminProfileResponse {
  profile: {
    id: number;
    email: string;
    firstname: string;
    lastname: string;
    fullname: string;
    gender: string;
    phone_number: string;
    role: string;
    is_active: boolean;
    is_approved: boolean;
    otp_enabled: boolean;
    pin_enabled: boolean;
    created_at: string;
    last_seen: string | null;
  };
  loginActivity: {
    id: number;
    session_token: string;
    login_at: string;
    last_active_at: string;
    logout_at: string | null;
  }[];
}

type SectionTab = "overview" | "personal" | "security" | "appearance";
type PersonalSubTab = "info" | "contact";

const INPUT_CLS =
  "w-full rounded-xl border border-white/12 bg-bg1/80 px-3.5 py-2.5 text-xs text-white placeholder:text-tl/45 focus:border-accent/55 focus:outline-none";

const GENDER_OPTIONS = ["Male", "Female", "Others"] as const;

export default function AdminSettingsPage() {
  const { data, isLoading, mutate } = useSWR<AdminProfileResponse>(
    "/api/admin/data?resource=admin_profile",
    swrPrivateConfig
  );

  const [activeSection, setActiveSection] = useState<SectionTab>("overview");
  const [personalTab, setPersonalTab] = useState<PersonalSubTab>("info");

  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!data?.profile) return;
    const p = data.profile;
    setFirstname(p.firstname.startsWith("gAAAAAB") ? "" : p.firstname);
    setLastname(p.lastname.startsWith("gAAAAAB") ? "" : p.lastname);
    setGender(p.gender.startsWith("gAAAAAB") ? "" : p.gender);
    setPhone(p.phone_number.startsWith("gAAAAAB") ? "" : p.phone_number);
  }, [data?.profile]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedback(null);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "admin_profile",
          action: "update_profile",
          payload: {
            firstname,
            lastname,
            gender,
            phone_number: phone,
          },
        },
      });
      await mutate();
      setFeedback({ ok: true, msg: "Personal profile updated." });
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Failed to save profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPw(true);
    setFeedback(null);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "admin_profile",
          action: "change_password",
          payload: {
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword,
          },
        },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({ ok: true, msg: "Password changed successfully." });
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Failed to change password.",
      });
    } finally {
      setSavingPw(false);
    }
  };

  const handleToggleSecurity = async (method: "otp" | "pin", nextVal: boolean) => {
    setFeedback(null);
    try {
      await apiMutate("/api/admin/data", {
        method: "PUT",
        body: {
          resource: "admin_profile",
          action: "toggle_security",
          payload: { method, enabled: nextVal },
        },
      });
      await mutate();
      setFeedback({
        ok: true,
        msg: `${method.toUpperCase()} verification ${nextVal ? "enabled" : "disabled"}.`,
      });
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Failed to update security flag.",
      });
    }
  };

  const p = data?.profile;
  const sessions = data?.loginActivity ?? [];
  const displayName =
    p?.fullname && !p.fullname.startsWith("gAAAAAB")
      ? p.fullname
      : [firstname, lastname].filter(Boolean).join(" ") || "Administrator";

  const pwRules = {
    len: newPassword.length >= 8 && newPassword.length <= 64,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    num: /[0-9]/.test(newPassword),
    special: /[@$!%*?&_#^]/.test(newPassword),
  };
  const pwMetCount = Object.values(pwRules).filter(Boolean).length;
  const pwAllMet = pwMetCount === 5;
  const pwMatches = confirmPassword.length > 0 && newPassword === confirmPassword;
  const pwStrengthPct = (pwMetCount / 5) * 100;
  const pwStrengthLabel =
    newPassword.length === 0
      ? "—"
      : pwMetCount <= 2
      ? "Weak"
      : pwMetCount <= 4
      ? "Fair"
      : "Strong";
  const pwStrengthColor =
    pwMetCount <= 2 ? "bg-danger" : pwMetCount <= 4 ? "bg-warn" : "bg-accent2";

  const adminSince = p?.created_at
    ? new Date(p.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const sectionTabs: { id: SectionTab; label: string; icon: typeof User }[] = [
    { id: "overview", label: "Overview", icon: User },
    { id: "personal", label: "Personal Details", icon: User },
    { id: "security", label: "Password & Security", icon: ShieldCheck },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  return (
    <StaffShell title="Settings">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-white">
            Admin <span className="text-accent">Settings</span>
          </h1>
          <p className="mt-1 text-[0.84rem] text-tl">
            Manage everything about your account from here.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/15 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-accent2">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Administrator
        </span>
      </div>

      {/* Section Tabs (legacy order: Overview, Personal Details, Password & Security, Appearance) */}
      <div
        role="tablist"
        aria-label="Admin settings sections"
        className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-white/4 p-1.5"
      >
        {sectionTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveSection(tab.id)}
              className={`flex flex-1 min-w-[130px] items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer ${
                active
                  ? "bg-accent/18 text-accent shadow-sm"
                  : "text-tl/70 hover:bg-white/6 hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          className={`mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs ${
            feedback.ok
              ? "border-accent2/30 bg-accent2/12 text-accent2"
              : "border-danger/30 bg-danger/12 text-danger"
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* 1. OVERVIEW */}
      {activeSection === "overview" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.02em] text-white">
              Good to see you, <span className="text-accent">{displayName}</span>
            </h2>
            <p className="mt-1 text-xs text-tl/75">
              Manage everything about your account from here.
            </p>
          </div>

          {/* Quick Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setActiveSection("personal")}
              className="flex flex-col items-start gap-2.5 rounded-2xl border border-white/10 bg-card-glass p-4 text-left transition hover:border-accent/40 cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <User className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-white">Personal Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("security")}
              className="flex flex-col items-start gap-2.5 rounded-2xl border border-white/10 bg-card-glass p-4 text-left transition hover:border-danger/40 cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger/15 text-danger">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-white">Password &amp; Security</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("appearance")}
              className="flex flex-col items-start gap-2.5 rounded-2xl border border-white/10 bg-card-glass p-4 text-left transition hover:border-accent2/40 cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent2/15 text-accent2">
                <Palette className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-white">Appearance</span>
            </button>
          </div>

          {/* Account Summary */}
          <div className="rounded-2xl border border-white/10 bg-card-glass overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
              <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent">
                <User className="h-4 w-4" /> Account Summary
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setActiveSection("personal")}
              >
                Edit
              </Button>
            </div>

            <div className="divide-y divide-white/6 text-xs">
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/12 text-accent">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Username / Email</div>
                    <div className="font-mono text-tl/70">
                      {isLoading ? "Loading..." : p?.email || "Not signed in"}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[0.7rem] uppercase text-accent">
                  {p?.role || "—"} {p?.id ? `· #${p.id}` : ""}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent2/12 text-accent2">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Account Status</div>
                    <div className="text-tl/70">
                      {p?.is_active && p?.is_approved ? "Active & Verified" : "Pending / Inactive"}
                    </div>
                  </div>
                </div>
                <span
                  className={`font-semibold ${
                    p?.is_active ? "text-accent2" : "text-danger"
                  }`}
                >
                  ● {p?.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warn/12 text-warn">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Admin Since</div>
                    <div className="text-tl/70">{adminSince}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Login Activity */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-glass">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
              <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent">
                <Clock className="h-4 w-4" /> Login Activity
              </span>
              <span className="rounded-lg border border-accent/25 bg-accent/10 px-2.5 py-1 text-[0.7rem] font-semibold text-accent">
                Recent sessions
              </span>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/8 bg-white/4 font-mono text-[0.68rem] uppercase text-white/55">
                    <th className="px-4 py-2.5">Session Token</th>
                    <th className="px-4 py-2.5">Login At</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-tl">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-tl/60">
                        No sessions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-white/4">
                        <td className="px-4 py-2.5 font-mono text-[0.72rem]">
                          {s.session_token.slice(0, 10)}…
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[0.72rem]">
                          {new Date(s.login_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[0.66rem] font-bold ${
                              s.logout_at
                                ? "bg-white/8 text-tl/70"
                                : "border border-accent2/30 bg-accent2/15 text-accent2"
                            }`}
                          >
                            {s.logout_at ? "Ended" : "Active"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. PERSONAL DETAILS */}
      {activeSection === "personal" && (
        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-[-0.02em] text-white">
                Personal <span className="text-accent">Details</span>
              </h2>
              <p className="mt-1 text-xs text-tl/75">Update your profile information.</p>
            </div>
            <Button type="submit" variant="accent" size="sm" disabled={savingProfile}>
              {savingProfile ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Changes
            </Button>
          </div>

          {/* Sub-tabs: Profile Info | Contact */}
          <div className="flex gap-1.5 rounded-xl border border-white/10 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setPersonalTab("info")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                personalTab === "info"
                  ? "bg-accent/18 text-accent"
                  : "text-tl/65 hover:bg-white/5 hover:text-white"
              }`}
            >
              <User className="h-3.5 w-3.5" /> Profile Info
            </button>
            <button
              type="button"
              onClick={() => setPersonalTab("contact")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                personalTab === "contact"
                  ? "bg-accent/18 text-accent"
                  : "text-tl/65 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Phone className="h-3.5 w-3.5" /> Contact
            </button>
          </div>

          {personalTab === "info" && (
            <div className="rounded-2xl border border-white/10 bg-card-glass overflow-hidden">
              <div className="border-b border-white/8 px-5 py-3.5">
                <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent">
                  <User className="h-4 w-4" /> Basic Info
                </span>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-tl">
                      First Name *
                    </label>
                    <input
                      required
                      maxLength={64}
                      value={firstname}
                      onChange={(e) => setFirstname(e.target.value)}
                      placeholder="First name"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-tl">
                      Last Name *
                    </label>
                    <input
                      required
                      maxLength={64}
                      value={lastname}
                      onChange={(e) => setLastname(e.target.value)}
                      placeholder="Last name"
                      className={INPUT_CLS}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-tl">Gender</label>
                  <div className="flex flex-wrap gap-2">
                    {GENDER_OPTIONS.map((opt) => {
                      const selected = gender === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setGender(opt)}
                          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                            selected
                              ? "border-accent bg-accent/20 text-accent"
                              : "border-white/14 bg-white/6 text-tl/75 hover:border-accent/50 hover:text-white"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-bg1/50 px-4 py-3 text-xs">
                  <div>
                    <div className="font-semibold text-white">Email / Username</div>
                    <div className="font-mono text-tl/70">{p?.email || "—"}</div>
                  </div>
                  <span className="text-[0.7rem] text-tl/45">Read-only</span>
                </div>
              </div>
            </div>
          )}

          {personalTab === "contact" && (
            <div className="rounded-2xl border border-white/10 bg-card-glass overflow-hidden">
              <div className="border-b border-white/8 px-5 py-3.5">
                <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent">
                  <Phone className="h-4 w-4" /> Contact
                </span>
              </div>
              <div className="p-5">
                <label className="mb-1.5 block text-xs font-semibold text-tl">
                  Phone Number
                </label>
                <input
                  type="tel"
                  maxLength={20}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0917 123 4567"
                  className={INPUT_CLS}
                />
              </div>
            </div>
          )}
        </form>
      )}

      {/* 3. PASSWORD & SECURITY */}
      {activeSection === "security" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.02em] text-white">
              Password <span className="text-accent">&amp; Security</span>
            </h2>
            <p className="mt-1 text-xs text-tl/75">Keep your account secure.</p>
          </div>

          {/* Multi-Factor Authentication */}
          <div className="rounded-2xl border border-white/10 bg-card-glass overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
              <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent">
                <ShieldCheck className="h-4 w-4" /> Multi-Factor Authentication
              </span>
              <span className="rounded-full bg-accent2/15 px-2.5 py-0.5 text-[0.68rem] font-bold text-accent2">
                Recommended
              </span>
            </div>

            <div className="divide-y divide-white/6">
              <div className="flex items-center justify-between gap-4 px-5 py-4 text-xs">
                <div>
                  <div className="font-semibold text-white">One-Time Password (OTP)</div>
                  <div className="mt-0.5 text-[0.74rem] text-tl/65">
                    Send a verification code to your email on login
                  </div>
                </div>
                <input
                  type="checkbox"
                  aria-label="Enable One-Time Password (OTP)"
                  checked={Boolean(p?.otp_enabled)}
                  onChange={(e) => handleToggleSecurity("otp", e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent2)] cursor-pointer"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-xs">
                <div>
                  <div className="font-semibold text-white">PIN Code</div>
                  <div className="mt-0.5 text-[0.74rem] text-tl/65">
                    Require your PIN after your password on login
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/reset-pin">Set / Reset PIN</Link>
                  </Button>
                  <input
                    type="checkbox"
                    aria-label="Enable PIN Code"
                    checked={Boolean(p?.pin_enabled)}
                    onChange={(e) => handleToggleSecurity("pin", e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent2)] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-white/6 px-5 py-3 text-[0.74rem] text-tl/60">
              <Info className="h-3.5 w-3.5 shrink-0 text-accent/70" />
              <span>Changes to these toggles are saved immediately.</span>
            </div>
          </div>

          {/* Change Password */}
          <form
            onSubmit={handleChangePassword}
            className="rounded-2xl border border-white/10 bg-card-glass overflow-hidden"
          >
            <div className="border-b border-white/8 px-5 py-3.5">
              <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent">
                <KeyRound className="h-4 w-4" /> Change Password
              </span>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-tl">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className={`${INPUT_CLS} pr-10`}
                  />
                  <button
                    type="button"
                    aria-label={showCurrentPw ? "Hide current password" : "Show current password"}
                    onClick={() => setShowCurrentPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-tl/55 hover:text-accent cursor-pointer"
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-tl">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    required
                    maxLength={64}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className={`${INPUT_CLS} pr-10`}
                  />
                  <button
                    type="button"
                    aria-label={showNewPw ? "Hide new password" : "Show new password"}
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-tl/55 hover:text-accent cursor-pointer"
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength Bar */}
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${pwStrengthColor}`}
                      style={{ width: `${pwStrengthPct}%` }}
                    />
                  </div>
                  <span className="min-w-[48px] text-right text-[0.72rem] font-bold text-tl/70">
                    {pwStrengthLabel}
                  </span>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="mb-3 text-[0.68rem] font-bold uppercase tracking-wider text-tl/55">
                  All requirements must be met before saving · only letters, numbers and @$!%*?&amp;_#^ are allowed
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { key: "len", met: pwRules.len, label: "At least 8 characters" },
                    { key: "upper", met: pwRules.upper, label: "Uppercase letter (A–Z)" },
                    { key: "lower", met: pwRules.lower, label: "Lowercase letter (a–z)" },
                    { key: "num", met: pwRules.num, label: "Number (0–9)" },
                    {
                      key: "special",
                      met: pwRules.special,
                      label: "Special character (@$!%*?&_#^)",
                    },
                  ].map((rule) => (
                    <div
                      key={rule.key}
                      className={`flex items-center gap-2 text-xs ${
                        rule.met ? "text-accent2" : "text-tl/50"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          rule.met
                            ? "border-accent2 bg-accent2/20 text-accent2"
                            : "border-white/20 text-transparent"
                        }`}
                      >
                        <Check className="h-2.5 w-2.5" />
                      </span>
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-tl">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    required
                    maxLength={64}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className={`${INPUT_CLS} pr-10`}
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPw ? "Hide confirm password" : "Show confirm password"}
                    onClick={() => setShowConfirmPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-tl/55 hover:text-accent cursor-pointer"
                  >
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <p
                    className={`mt-1.5 text-[0.72rem] ${
                      pwMatches ? "text-accent2" : "text-danger"
                    }`}
                  >
                    {pwMatches ? "Passwords match." : "Passwords do not match."}
                  </p>
                )}
              </div>

              <div className="flex justify-end border-t border-white/8 pt-4">
                <Button
                  type="submit"
                  variant="accent"
                  size="sm"
                  disabled={savingPw || !currentPassword || !pwAllMet || !pwMatches}
                >
                  {savingPw ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" />
                  )}
                  Update Password
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 4. APPEARANCE */}
      {activeSection === "appearance" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.02em] text-white">
              Appearance <span className="text-accent">Settings</span>
            </h2>
            <p className="mt-1 text-xs text-tl/75">
              Customize how the library looks for you.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-card-glass overflow-hidden">
            <div className="border-b border-white/8 px-5 py-3.5">
              <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent">
                <Palette className="h-4 w-4" /> Color Theme
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-4 text-xs">
              <div>
                <div className="font-semibold text-white">Theme Mode</div>
                <div className="mt-0.5 text-[0.74rem] text-tl/65">
                  Switch between Dark and Light mode.
                </div>
              </div>
              <ThemeToggle />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-card-glass overflow-hidden">
            <div className="border-b border-white/8 px-5 py-3.5">
              <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent">
                <Globe className="h-4 w-4" /> Language
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-xs">
              <div>
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span>Interface Language</span>
                  <span className="rounded-full border border-white/15 bg-white/6 px-2 py-0.5 text-[0.65rem] font-semibold text-tl/65">
                    Not available yet
                  </span>
                </div>
                <div className="mt-0.5 text-[0.74rem] text-tl/65">
                  Changes labeled navigation and UI text
                </div>
              </div>
              <select
                disabled
                defaultValue="english"
                aria-label="Interface Language (not available yet)"
                className="rounded-xl border border-white/12 bg-bg1/60 px-3 py-2 text-xs text-tl/55 opacity-60 cursor-not-allowed"
              >
                <option value="english">English</option>
                <option value="filipino">Filipino</option>
                <option value="hiligaynon">Hiligaynon</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
