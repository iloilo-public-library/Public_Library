"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  Heart,
  History,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Palette,
  Save,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  User,
} from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { apiMutate, swrPrivateConfig } from "@/lib/api";

interface UserSettingsResponse {
  ok: boolean;
  profile: {
    id: number;
    email: string;
    firstname: string;
    lastname: string;
    fullname: string;
    gender: string;
    phone_number: string;
    city: string;
    province: string;
    school: string;
    occupation: string;
    role: string;
    is_active: boolean;
    is_approved: boolean;
    otp_enabled: boolean;
    pin_enabled: boolean;
    created_at: string;
    last_seen: string | null;
  };
  counts: {
    favorites: number;
    searchHistory: number;
  };
  latestAccountRequest: {
    id: number;
    request_type: string;
    status: string;
    reason: string;
    admin_note: string;
    created_at: string;
  } | null;
  loginActivity: {
    id: number;
    session_token: string;
    login_at: string;
    last_active_at: string;
    logout_at: string | null;
  }[];
}

type SettingsSection = "overview" | "personal" | "security" | "preferences";

interface MemberPreferences {
  language: "en" | "tl" | "hil";
  dueReminders: boolean;
  eventAlerts: boolean;
  libraryBulletins: boolean;
  compactTables: boolean;
}

const DEFAULT_PREFS: MemberPreferences = {
  language: "en",
  dueReminders: true,
  eventAlerts: true,
  libraryBulletins: true,
  compactTables: false,
};

const PREFS_STORAGE_KEY = "icpl-member-prefs";

const INPUT_CLS =
  "w-full rounded-xl border border-white/12 bg-bg1/80 px-3.5 py-2.5 text-xs text-white placeholder:text-tl/45 focus:border-accent/55 focus:outline-none";

const SIDEBAR_ITEMS: { key: SettingsSection; label: string; icon: typeof User; desc: string }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, desc: "Account summary & sessions" },
  { key: "personal", label: "Personal Details", icon: User, desc: "Name, contact & address" },
  { key: "security", label: "Password & Security", icon: ShieldCheck, desc: "Password, OTP, PIN & privacy" },
  { key: "preferences", label: "Preferences", icon: SlidersHorizontal, desc: "Language & alert settings" },
];

function cleanField(val: string | undefined): string {
  if (!val || val.startsWith("gAAAAAB")) return "";
  return val;
}

export default function UserSettingsPage() {
  const { theme, setTheme, language, setLanguage } = useTheme();
  const { data, isLoading, mutate } = useSWR<UserSettingsResponse>(
    "/api/user/settings",
    swrPrivateConfig
  );

  const [activeSection, setActiveSection] = useState<SettingsSection>("overview");

  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [school, setSchool] = useState("");
  const [occupation, setOccupation] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [requestType, setRequestType] = useState<"deactivate" | "delete">("deactivate");
  const [requestReason, setRequestReason] = useState("");

  const [prefs, setPrefs] = useState<MemberPreferences>(DEFAULT_PREFS);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MemberPreferences>;
        setPrefs((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    const p = data?.profile;
    if (!p) return;
    setFirstname(cleanField(p.firstname));
    setLastname(cleanField(p.lastname));
    setGender(cleanField(p.gender));
    setPhone(cleanField(p.phone_number));
    setCity(cleanField(p.city));
    setProvince(cleanField(p.province));
    setSchool(cleanField(p.school));
    setOccupation(cleanField(p.occupation));
  }, [data?.profile]);

  const runMutation = async (
    key: string,
    body: Record<string, unknown>,
    successMsg: string,
    onSuccess?: () => void
  ) => {
    setBusyAction(key);
    setFeedback(null);
    try {
      await apiMutate("/api/user/settings", { method: "PUT", body });
      await mutate();
      setFeedback({ ok: true, msg: successMsg });
      onSuccess?.();
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Operation failed.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    void runMutation(
      "profile",
      {
        action: "update_profile",
        firstname,
        lastname,
        gender,
        phone_number: phone,
        city,
        province,
        school,
        occupation,
      },
      "Personal profile updated."
    );
  };

  const handleChangePassword = (e: FormEvent) => {
    e.preventDefault();
    void runMutation(
      "password",
      {
        action: "change_password",
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      },
      "Password updated successfully.",
      () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    );
  };

  const handleSubmitAccountRequest = (e: FormEvent) => {
    e.preventDefault();
    void runMutation(
      "account_request",
      {
        action: "submit_account_request",
        request_type: requestType,
        reason: requestReason,
      },
      `Account ${requestType} request submitted for administrator review.`,
      () => setRequestReason("")
    );
  };

  const handleSavePreferences = (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
      setFeedback({ ok: true, msg: "Member preferences saved on this device." });
    } catch {
      setFeedback({ ok: false, msg: "Unable to save preferences to local storage." });
    }
  };

  const p = data?.profile;
  const sessions = data?.loginActivity ?? [];
  const latestReq = data?.latestAccountRequest;
  const initials =
    ((firstname || p?.firstname || "M").charAt(0) + (lastname || p?.lastname || "").charAt(0))
      .toUpperCase() || "M";

  return (
    <MemberShell>
      {/* Editorial Header */}
      <div className="mb-6">
        <div className="mb-1.5 font-mono text-[0.68rem] font-bold tracking-[0.16em] text-gold uppercase">
          Member Portal &middot; Account Management
        </div>
        <h1 className="font-serif text-[clamp(1.85rem,3vw,2.5rem)] font-bold leading-tight tracking-[-0.02em] text-white">
          Account &amp; <span className="text-accent">Settings</span>
        </h1>
        <p className="mt-1 text-sm text-tl/80">
          Manage your account overview, personal details, security protections, and preferences.
        </p>
      </div>

      {feedback && (
        <div
          className={`mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs backdrop-blur-md ${
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

      {/* Two-Column Sidebar + Section Layout */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* LEFT SIDEBAR */}
        <aside className="w-full rounded-[22px] border border-white/10 bg-white/[0.035] p-4 backdrop-blur-md lg:sticky lg:top-[88px] lg:w-[270px] lg:shrink-0">
          {/* Member Mini-Header */}
          <div className="mb-4 flex items-center gap-3 border-b border-white/8 pb-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/12 font-serif text-sm font-bold text-gold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">
                {isLoading ? "Loading..." : p?.fullname || `${firstname} ${lastname}`.trim() || "Member"}
              </div>
              <div className="truncate font-mono text-[0.7rem] text-tl/65">
                {p?.email || "—"}
              </div>
            </div>
          </div>

          {/* Section Navigation */}
          <nav aria-label="Account settings sections" className="flex flex-wrap gap-1.5 lg:flex-col">
            {SIDEBAR_ITEMS.map(({ key, label, icon: Icon, desc }) => {
              const active = activeSection === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSection(key)}
                  className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition lg:flex-none lg:w-full ${
                    active
                      ? "border-accent/35 bg-accent/15 text-accent"
                      : "border-transparent text-tl/75 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight">{label}</div>
                    <div className="hidden text-[0.68rem] text-tl/55 lg:block">{desc}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* RIGHT SECTION CONTENT */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* 1. OVERVIEW */}
          {activeSection === "overview" && (
            <>
              <div className="space-y-5 rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/25 bg-accent/15 text-accent">
                      <LayoutDashboard className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-serif text-base font-bold text-white">
                        Account Overview
                      </h2>
                      <p className="text-xs text-tl/70">Active authenticated member session</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveSection("personal")}
                    >
                      Edit Personal Details
                    </Button>
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => setActiveSection("security")}
                    >
                      Manage Security
                    </Button>
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs">
                    <dt className="font-mono text-[0.65rem] tracking-wider text-tl/60 uppercase">
                      Email Address
                    </dt>
                    <dd className="mt-1 truncate font-mono text-white">
                      {isLoading ? "Loading..." : p?.email || "—"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs">
                    <dt className="font-mono text-[0.65rem] tracking-wider text-tl/60 uppercase">
                      Account Status
                    </dt>
                    <dd className="mt-1 font-mono text-accent2">
                      {p?.is_active && p?.is_approved ? "Active & Verified" : "Pending / Inactive"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs">
                    <dt className="font-mono text-[0.65rem] tracking-wider text-tl/60 uppercase">
                      Two-Factor OTP
                    </dt>
                    <dd className={`mt-1 font-mono ${p?.otp_enabled ? "text-accent2" : "text-tl/70"}`}>
                      {p?.otp_enabled ? "Enabled" : "Disabled"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs">
                    <dt className="font-mono text-[0.65rem] tracking-wider text-tl/60 uppercase">
                      6-Digit Security PIN
                    </dt>
                    <dd className={`mt-1 font-mono ${p?.pin_enabled ? "text-accent2" : "text-tl/70"}`}>
                      {p?.pin_enabled ? "Enabled" : "Disabled"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Recent Login Sessions */}
              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] backdrop-blur-md">
                <div className="flex items-center gap-2 border-b border-white/8 px-5 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-accent">
                  <Clock className="h-4 w-4" /> Recent Login Activity
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
                            No recorded sessions found.
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
            </>
          )}

          {/* 2. PERSONAL DETAILS */}
          {activeSection === "personal" && (
            <form
              onSubmit={handleSaveProfile}
              className="space-y-4 rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <div className="flex items-center gap-2.5">
                  <User className="h-5 w-5 text-accent2" />
                  <div>
                    <h2 className="font-serif text-base font-bold text-white">Personal Details</h2>
                    <p className="text-xs text-tl/65">
                      Update your legal name, contact number, and residence details
                    </p>
                  </div>
                </div>
                <Button type="submit" variant="accent" size="sm" disabled={busyAction === "profile"}>
                  {busyAction === "profile" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save Changes
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tl">First Name *</label>
                  <input
                    required
                    value={firstname}
                    onChange={(e) => setFirstname(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tl">Last Name *</label>
                  <input
                    required
                    value={lastname}
                    onChange={(e) => setLastname(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tl">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className={INPUT_CLS}
                  >
                    <option value="" className="bg-modal text-white">Select</option>
                    <option value="Male" className="bg-modal text-white">Male</option>
                    <option value="Female" className="bg-modal text-white">Female</option>
                    <option value="Others" className="bg-modal text-white">Others</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tl">Phone Number</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09XXXXXXXXX"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tl">City</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tl">Province</label>
                  <input
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tl">School</label>
                  <input
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tl">Occupation</label>
                  <input
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </form>
          )}

          {/* 3. PASSWORD & SECURITY */}
          {activeSection === "security" && (
            <>
              {/* Security Flags (OTP + PIN) */}
              <div className="space-y-4 rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md">
                <div className="flex items-center gap-2.5 border-b border-white/8 pb-3">
                  <ShieldCheck className="h-5 w-5 text-gold" />
                  <h2 className="font-serif text-base font-bold text-white">
                    Two-Factor &amp; PIN Protection
                  </h2>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs">
                    <div>
                      <div className="font-semibold text-white">Email OTP Verification</div>
                      <div className="text-[0.7rem] text-tl/65">
                        Require one-time verification code on login
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(p?.otp_enabled)}
                      onChange={(e) =>
                        void runMutation(
                          "otp",
                          { action: "toggle_security", method: "otp", enabled: e.target.checked },
                          `Email OTP ${e.target.checked ? "enabled" : "disabled"}.`
                        )
                      }
                      className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs">
                    <div>
                      <div className="font-semibold text-white">6-Digit Security PIN</div>
                      <div className="text-[0.7rem] text-tl/65">
                        Secondary PIN protection (
                        <Link href="/reset-pin" className="text-accent underline">
                          Reset PIN
                        </Link>
                        )
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(p?.pin_enabled)}
                      onChange={(e) =>
                        void runMutation(
                          "pin",
                          { action: "toggle_security", method: "pin", enabled: e.target.checked },
                          `Security PIN ${e.target.checked ? "enabled" : "disabled"}.`
                        )
                      }
                      className="h-4 w-4 cursor-pointer accent-[var(--accent2)]"
                    />
                  </div>
                </div>
              </div>

              {/* Change Password */}
              <form
                onSubmit={handleChangePassword}
                className="space-y-3.5 rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md"
              >
                <div className="flex items-center justify-between border-b border-white/8 pb-3">
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="h-5 w-5 text-accent" />
                    <h2 className="font-serif text-base font-bold text-white">Change Password</h2>
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={busyAction === "password"}
                  >
                    {busyAction === "password" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5" />
                    )}
                    Update Password
                  </Button>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-tl">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-tl">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 chars + upper/lower/num/symbol"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-tl">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              </form>

              {/* Privacy & Account Controls */}
              <div className="space-y-4 rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md">
                <div className="flex items-center gap-2.5 border-b border-white/8 pb-3">
                  <ShieldAlert className="h-5 w-5 text-warn" />
                  <h2 className="font-serif text-base font-bold text-white">
                    Privacy &amp; Account Controls
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyAction === "clear_history"}
                    onClick={() =>
                      void runMutation(
                        "clear_history",
                        { action: "clear_search_history" },
                        "Search history cleared."
                      )
                    }
                  >
                    <History className="h-3.5 w-3.5" />
                    Clear Search History ({data?.counts.searchHistory ?? 0})
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyAction === "clear_favs"}
                    onClick={() =>
                      void runMutation(
                        "clear_favs",
                        { action: "clear_favorites" },
                        "Saved favorites cleared."
                      )
                    }
                  >
                    <Heart className="h-3.5 w-3.5" />
                    Clear Favorites ({data?.counts.favorites ?? 0})
                  </Button>
                </div>

                <form
                  onSubmit={handleSubmitAccountRequest}
                  className="space-y-3 border-t border-white/8 pt-4"
                >
                  <div className="text-xs font-semibold text-white">
                    Request Account Deactivation or Deletion
                  </div>
                  {latestReq && (
                    <div className="rounded-xl border border-white/10 bg-bg1/60 px-3 py-2 text-[0.72rem] text-tl/80">
                      Latest request:{" "}
                      <strong className="capitalize text-white">{latestReq.request_type}</strong> —{" "}
                      <span className="capitalize text-accent">{latestReq.status}</span>
                      {latestReq.admin_note ? ` (${latestReq.admin_note})` : ""}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <select
                      value={requestType}
                      onChange={(e) => setRequestType(e.target.value as "deactivate" | "delete")}
                      className={INPUT_CLS}
                    >
                      <option value="deactivate" className="bg-modal text-white">
                        Deactivate Account
                      </option>
                      <option value="delete" className="bg-modal text-white">
                        Delete Account
                      </option>
                    </select>
                    <input
                      required
                      minLength={5}
                      value={requestReason}
                      onChange={(e) => setRequestReason(e.target.value)}
                      placeholder="Reason for request..."
                      className={`${INPUT_CLS} sm:col-span-2`}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={busyAction === "account_request"}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                    Submit Request
                  </Button>
                </form>
              </div>
            </>
          )}

          {/* 4. PREFERENCES */}
          {activeSection === "preferences" && (
            <form
              onSubmit={handleSavePreferences}
              className="space-y-5 rounded-[22px] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="h-5 w-5 text-gold" />
                  <div>
                    <h2 className="font-serif text-base font-bold text-white">Preferences</h2>
                    <p className="text-xs text-tl/65">
                      Customize your portal language and notification alert preferences
                    </p>
                  </div>
                </div>
                <Button type="submit" variant="accent" size="sm">
                  <Save className="h-3.5 w-3.5" /> Save Preferences
                </Button>
              </div>

              {/* Portal Theme */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Palette className="h-3.5 w-3.5 text-gold" />
                  Portal Theme
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {(
                    [
                      {
                        mode: "default",
                        label: "Civic Navy",
                        sub: "Official library palette",
                        swatches: ["#1e2d3d", "#2f3f4d", "#9fc1e1"],
                      },
                      {
                        mode: "dark",
                        label: "Midnight Dark",
                        sub: "Deep obsidian surface",
                        swatches: ["#0d1117", "#141a22", "#9fc1e1"],
                      },
                      {
                        mode: "light",
                        label: "Daylight Light",
                        sub: "Ice white, deep teal & soft peach",
                        swatches: ["#edf2f3", "#0f5c64", "#f4b99b"],
                      },
                      {
                        mode: "cobalt",
                        label: "Mauve Lavender",
                        sub: "Mauve taupe, pale lavender & chrome",
                        swatches: ["#efebf5", "#8c6b7e", "#9b87c4"],
                      },
                      {
                        mode: "riso",
                        label: "Riso Cream",
                        sub: "Cream paper, riso teal & pink",
                        swatches: ["#F8DBC1", "#1D646C", "#EA4F88"],
                      },
                      {
                        mode: "clay",
                        label: "Raw Clay",
                        sub: "Raw clay, iron brown & turquoise",
                        swatches: ["#D0BCAC", "#461C0C", "#269081"],
                      },
                    ] as const
                  ).map((item) => {
                    const active = theme === item.mode;
                    return (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => setTheme(item.mode)}
                        className={`cursor-pointer rounded-xl border px-3.5 py-3 text-left transition ${
                          active
                            ? "border-gold/50 bg-gold/12 text-gold"
                            : "border-white/10 bg-white/[0.025] text-tl/80 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold">{item.label}</span>
                          <span className="flex items-center gap-1">
                            {item.swatches.map((hex) => (
                              <span
                                key={hex}
                                style={{ backgroundColor: hex }}
                                className="h-3 w-3 rounded-full border border-white/20"
                              />
                            ))}
                          </span>
                        </div>
                        <div className="mt-1 text-[0.68rem] opacity-75">{item.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interface Language */}
              <div className="space-y-2 border-t border-white/8 pt-4">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Globe className="h-3.5 w-3.5 text-accent" />
                  Display Language
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      { code: "english", label: "English", sub: "Default portal text" },
                      { code: "filipino", label: "Filipino", sub: "Tagalog labels" },
                      { code: "hiligaynon", label: "Hiligaynon", sub: "Ilonggo regional labels" },
                    ] as const
                  ).map((lang) => {
                    const active = language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setLanguage(lang.code)}
                        className={`cursor-pointer rounded-xl border px-3.5 py-2.5 text-left transition ${
                          active
                            ? "border-gold/45 bg-gold/12 text-gold"
                            : "border-white/10 bg-white/[0.025] text-tl/80 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        <div className="text-xs font-bold">{lang.label}</div>
                        <div className="text-[0.68rem] opacity-75">{lang.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Alert & Display Toggles */}
              <div className="space-y-2.5 border-t border-white/8 pt-4">
                {(
                  [
                    {
                      key: "dueReminders",
                      title: "Due Date Reminders",
                      desc: "Show reminder banners before borrowed books become overdue",
                    },
                    {
                      key: "eventAlerts",
                      title: "Upcoming Event Alerts",
                      desc: "Highlight new library workshops and community events",
                    },
                    {
                      key: "libraryBulletins",
                      title: "Official Library Bulletins",
                      desc: "Receive schedule changes and holiday closure notices",
                    },
                    {
                      key: "compactTables",
                      title: "Compact Table Density",
                      desc: "Use tighter row spacing in Borrow History and Catalog tables",
                    },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs transition hover:border-white/15"
                  >
                    <div>
                      <div className="font-semibold text-white">{item.title}</div>
                      <div className="text-[0.7rem] text-tl/65">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs[item.key]}
                      onChange={(e) =>
                        setPrefs((prev) => ({ ...prev, [item.key]: e.target.checked }))
                      }
                      className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                    />
                  </label>
                ))}
              </div>
            </form>
          )}
        </div>
      </div>
    </MemberShell>
  );
}
