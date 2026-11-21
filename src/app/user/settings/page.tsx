"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Heart,
  History,
  KeyRound,
  Loader2,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { MemberShell } from "@/components/layout/MemberShell";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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

const INPUT_CLS =
  "w-full rounded-xl border border-white/12 bg-bg1/80 px-3.5 py-2.5 text-xs text-white placeholder:text-tl/45 focus:border-accent/55 focus:outline-none";

function cleanField(val: string | undefined): string {
  if (!val || val.startsWith("gAAAAAB")) return "";
  return val;
}

export default function UserSettingsPage() {
  const { data, isLoading, mutate } = useSWR<UserSettingsResponse>(
    "/api/user/settings",
    swrPrivateConfig
  );

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

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

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

  const p = data?.profile;
  const sessions = data?.loginActivity ?? [];
  const latestReq = data?.latestAccountRequest;

  return (
    <MemberShell>
      <div className="mb-6">
        <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
          Account <span className="text-accent">Settings</span>
        </h1>
        <p className="mt-1 text-sm text-tl/80">
          Manage your profile details, security options, privacy data, and login sessions.
        </p>
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Account Overview & Security Flags */}
        <div className="space-y-5 rounded-2xl border border-white/10 bg-card-glass p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Account &amp; Security</h2>
                <p className="text-xs text-tl/70">Authenticated via Supabase session</p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <dl className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-white/6 pb-2">
              <dt className="text-tl/60">Email</dt>
              <dd className="font-mono text-white">
                {isLoading ? "Loading..." : p?.email || "—"}
              </dd>
            </div>
            <div className="flex justify-between border-b border-white/6 pb-2">
              <dt className="text-tl/60">Role</dt>
              <dd className="font-mono uppercase text-accent">{p?.role || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tl/60">Account Status</dt>
              <dd className="font-mono text-accent2">
                {p?.is_active && p?.is_approved ? "Active & Verified" : "Pending / Inactive"}
              </dd>
            </div>
          </dl>

          <div className="space-y-3 border-t border-white/8 pt-4">
            <div className="flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-white">Email OTP Verification</div>
                <div className="text-[0.7rem] text-tl/65">Require one-time code on login</div>
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
                className="h-4 w-4 accent-[var(--accent)] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
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
                className="h-4 w-4 accent-[var(--accent2)] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Personal Profile Editor */}
        <form
          onSubmit={handleSaveProfile}
          className="space-y-4 rounded-2xl border border-white/10 bg-card-glass p-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-accent2" />
              <h2 className="text-sm font-bold text-white">Personal Information</h2>
            </div>
            <Button type="submit" variant="accent" size="sm" disabled={busyAction === "profile"}>
              {busyAction === "profile" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        {/* Change Password */}
        <form
          onSubmit={handleChangePassword}
          className="space-y-3.5 rounded-2xl border border-white/10 bg-card-glass p-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-5 w-5 text-accent" />
              <h2 className="text-sm font-bold text-white">Change Password</h2>
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
              Update
            </Button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-tl">Current Password</label>
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

        {/* Privacy & Account Requests */}
        <div className="space-y-4 rounded-2xl border border-white/10 bg-card-glass p-6">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-warn" />
            <h2 className="text-sm font-bold text-white">Privacy &amp; Account Controls</h2>
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
                Latest request: <strong className="capitalize text-white">{latestReq.request_type}</strong>{" "}
                — <span className="capitalize text-accent">{latestReq.status}</span>
                {latestReq.admin_note ? ` (${latestReq.admin_note})` : ""}
              </div>
            )}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as "deactivate" | "delete")}
                className={INPUT_CLS}
              >
                <option value="deactivate" className="bg-modal text-white">Deactivate Account</option>
                <option value="delete" className="bg-modal text-white">Delete Account</option>
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

        {/* Recent Login Sessions */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-glass lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-white/8 px-5 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-accent">
            <Clock className="h-4 w-4" /> Recent Login Activity
          </div>
          <div className="max-h-[240px] overflow-y-auto">
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
      </div>
    </MemberShell>
  );
}
