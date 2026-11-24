"use client";

import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import { StaffShell } from "@/components/layout/StaffShell";
import { Button } from "@/components/ui/button";
import { apiMutate, swrPrivateConfig } from "@/lib/api";

interface StaffProfileResponse {
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

const INPUT_CLS =
  "w-full rounded-xl border border-white/12 bg-bg1/80 px-3.5 py-2.5 text-xs text-white placeholder:text-tl/45 focus:border-accent/55 focus:outline-none";

export default function LibrarianSettingsPage() {
  const { data, isLoading, mutate } = useSWR<StaffProfileResponse>(
    "/api/admin/data?resource=admin_profile",
    swrPrivateConfig
  );

  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  return (
    <StaffShell title="Librarian Settings" role="librarian">
      <div className="mb-6">
        <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-white">
          Librarian <span className="text-accent">Settings</span>
        </h1>
        <p className="mt-1 text-[0.84rem] text-tl">
          Account summary, personal details editor, password management, and session activity.
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
        {/* Account Overview & Theme */}
        <div className="rounded-2xl border border-white/10 bg-card-glass p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Signed-In Account</h2>
                <p className="text-xs text-tl/70">Active authenticated staff session</p>
              </div>
            </div>
          </div>

          <dl className="space-y-2.5 text-xs">
            <div className="flex justify-between border-b border-white/6 pb-2">
              <dt className="text-tl/60">Email</dt>
              <dd className="font-mono text-white">
                {isLoading ? "Loading..." : p?.email || "Not signed in"}
              </dd>
            </div>
            <div className="flex justify-between border-b border-white/6 pb-2">
              <dt className="text-tl/60">Role</dt>
              <dd className="font-mono uppercase text-accent">{p?.role || "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-white/6 pb-2">
              <dt className="text-tl/60">User ID</dt>
              <dd className="font-mono text-white">{p?.id ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tl/60">Account Status</dt>
              <dd className="font-mono text-accent2">
                {p?.is_active && p?.is_approved ? "Active & Verified" : "Pending / Inactive"}
              </dd>
            </div>
          </dl>

          <div className="border-t border-white/8 pt-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-white">Email OTP Verification</div>
                <div className="text-[0.7rem] text-tl/65">Require one-time passcode on sign-in</div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(p?.otp_enabled)}
                onChange={(e) => handleToggleSecurity("otp", e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-white">6-Digit PIN Gate</div>
                <div className="text-[0.7rem] text-tl/65">Enable secondary PIN verification flag</div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(p?.pin_enabled)}
                onChange={(e) => handleToggleSecurity("pin", e.target.checked)}
                className="h-4 w-4 accent-[var(--accent2)] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Edit Personal Details */}
        <form
          onSubmit={handleSaveProfile}
          className="rounded-2xl border border-white/10 bg-card-glass p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-accent2" />
              <h2 className="text-sm font-bold text-white">Personal Details</h2>
            </div>
            <Button type="submit" variant="accent" size="sm" disabled={savingProfile}>
              {savingProfile ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Profile
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
          </div>
        </form>

        {/* Change Password */}
        <form
          onSubmit={handleChangePassword}
          className="rounded-2xl border border-white/10 bg-card-glass p-6 space-y-3.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-5 w-5 text-accent" />
              <h2 className="text-sm font-bold text-white">Change Password</h2>
            </div>
            <Button type="submit" variant="secondary" size="sm" disabled={savingPw}>
              {savingPw ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              Update Password
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
              <label className="mb-1 block text-xs font-semibold text-tl">Confirm New Password</label>
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

        {/* Login Session Activity */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-glass">
          <div className="flex items-center gap-2 border-b border-white/8 px-5 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-accent">
            <Clock className="h-4 w-4" /> Recent Login Activity
          </div>
          <div className="max-h-[260px] overflow-y-auto">
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
    </StaffShell>
  );
}
