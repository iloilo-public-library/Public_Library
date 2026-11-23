"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Check,
  Eye,
  EyeOff,
  Hash,
  Info,
  KeyRound,
  Loader2,
  Lock,
  MailCheck,
  ShieldCheck,
} from "lucide-react";

interface SecuritySectionProps {
  otpEnabled: boolean;
  pinEnabled: boolean;
  onToggleSecurity: (method: "otp" | "pin", nextVal: boolean) => Promise<void>;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onChangeCurrentPassword: (val: string) => void;
  onChangeNewPassword: (val: string) => void;
  onChangeConfirmPassword: (val: string) => void;
  savingPw: boolean;
  onSubmitPassword: (e: FormEvent) => Promise<void>;
}

export function SecuritySection({
  otpEnabled,
  pinEnabled,
  onToggleSecurity,
  currentPassword,
  newPassword,
  confirmPassword,
  onChangeCurrentPassword,
  onChangeNewPassword,
  onChangeConfirmPassword,
  savingPw,
  onSubmitPassword,
}: SecuritySectionProps) {
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [toggling, setToggling] = useState<"otp" | "pin" | null>(null);

  const pwRules = {
    len: newPassword.length >= 8 && newPassword.length <= 64,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    num: /[0-9]/.test(newPassword),
    special: /[@$!%*?&_#^]/.test(newPassword),
  };
  const pwMetCount = Object.values(pwRules).filter(Boolean).length;
  const pwAllowedChars = newPassword.length > 0 && /^[A-Za-z\d@$!%*?&_#^]+$/.test(newPassword);
  const pwAllMet = pwMetCount === 5 && pwAllowedChars;
  const pwMatches = confirmPassword.length > 0 && newPassword === confirmPassword;
  const pwStrengthPct = newPassword.length > 0 ? (pwMetCount / 5) * 100 : 0;

  const pwStrengthLabel =
    newPassword.length === 0
      ? "—"
      : pwMetCount <= 2
      ? "Weak"
      : pwMetCount <= 4
      ? "Medium"
      : "Strong";

  const pwStrengthColor =
    newPassword.length === 0
      ? "var(--as-text-muted)"
      : pwMetCount <= 2
      ? "var(--danger)"
      : pwMetCount <= 4
      ? "var(--warn)"
      : "var(--accent2)";

  const handleToggle = async (method: "otp" | "pin", nextVal: boolean) => {
    setToggling(method);
    try {
      await onToggleSecurity(method, nextVal);
    } finally {
      setToggling(null);
    }
  };

  return (
    <section id="security" aria-labelledby="security-heading">
      <div className="mb-6">
        <h2
          id="security-heading"
          className="mb-[5px] text-[1.45rem] font-bold tracking-[-0.03em]"
          style={{ color: "var(--as-text-primary)" }}
        >
          Password <span style={{ color: "var(--accent)" }}>&amp; Security</span>
        </h2>
        <p className="text-[0.85rem]" style={{ color: "var(--as-text-secondary)" }}>
          Keep your account secure.
        </p>
      </div>

      {/* Multi-Factor Authentication */}
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
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Multi-Factor Authentication
          </span>
          <span
            className="rounded-full px-2.5 py-[3px] text-[0.68rem] font-bold"
            style={{
              backgroundColor: "rgba(var(--accent2-rgb), 0.15)",
              color: "var(--accent2)",
            }}
          >
            Recommended
          </span>
        </div>

        {/* OTP Row */}
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
              <MailCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <div
                className="mb-0.5 text-[0.88rem] font-semibold"
                style={{ color: "var(--as-text-primary)" }}
              >
                One-Time Password (OTP)
              </div>
              <div className="text-[0.75rem]" style={{ color: "var(--as-text-muted)" }}>
                Send a verification code to your email on login
              </div>
            </div>
          </div>

          <label className="relative inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-end">
            <input
              type="checkbox"
              aria-label="Enable One-Time Password (OTP)"
              checked={otpEnabled}
              disabled={toggling === "otp"}
              onChange={(e) => void handleToggle("otp", e.target.checked)}
              className="peer sr-only"
            />
            <span
              className="relative inline-block h-[22px] w-[40px] rounded-full transition-colors peer-disabled:opacity-50"
              style={{
                backgroundColor: otpEnabled ? "var(--accent2)" : "var(--as-toggle-off)",
              }}
            >
              <span
                className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  otpEnabled ? "translate-x-[18px]" : "translate-x-0"
                }`}
              />
            </span>
          </label>
        </div>

        {/* PIN Code Row */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--as-border-subtle)" }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-[13px]">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
              style={{
                backgroundColor: "var(--as-gold-bg)",
                color: "var(--gold)",
              }}
            >
              <Hash className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <div
                className="mb-0.5 text-[0.88rem] font-semibold"
                style={{ color: "var(--as-text-primary)" }}
              >
                PIN Code
              </div>
              <div className="text-[0.75rem]" style={{ color: "var(--as-text-muted)" }}>
                Require your PIN after your password on login
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/reset-pin"
              className="inline-flex min-h-[44px] items-center rounded-lg px-3.5 py-1.5 text-[0.78rem] font-semibold transition"
              style={{
                backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                border: "1px solid rgba(var(--accent-rgb), 0.2)",
                color: "var(--accent)",
              }}
            >
              Set / Reset PIN
            </Link>
            <label className="relative inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-end">
              <input
                type="checkbox"
                aria-label="Enable PIN Code"
                checked={pinEnabled}
                disabled={toggling === "pin"}
                onChange={(e) => void handleToggle("pin", e.target.checked)}
                className="peer sr-only"
              />
              <span
                className="relative inline-block h-[22px] w-[40px] rounded-full transition-colors peer-disabled:opacity-50"
                style={{
                  backgroundColor: pinEnabled ? "var(--accent2)" : "var(--as-toggle-off)",
                }}
              >
                <span
                  className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    pinEnabled ? "translate-x-[18px]" : "translate-x-0"
                  }`}
                />
              </span>
            </label>
          </div>
        </div>

        {/* Info Footer */}
        <div
          className="flex items-center gap-2 px-5 pb-3.5 pt-2.5 text-[0.76rem]"
          style={{ color: "var(--as-text-faint)" }}
        >
          <Info
            className="h-3.5 w-3.5 shrink-0 opacity-70"
            style={{ color: "var(--accent)" }}
            aria-hidden="true"
          />
          <span>Changes to these toggles are saved immediately.</span>
        </div>
      </div>

      {/* Change Password */}
      <form
        onSubmit={(e) => void onSubmitPassword(e)}
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
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Change Password
          </span>
        </div>

        {/* Current Password */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--as-border-subtle)" }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-[13px]">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
              style={{
                backgroundColor: "rgba(var(--warn-rgb), 0.12)",
                color: "var(--warn)",
              }}
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
            </span>
            <label
              htmlFor="as-pw-current"
              className="text-[0.88rem] font-semibold"
              style={{ color: "var(--as-text-primary)" }}
            >
              Current Password
            </label>
          </div>
          <div className="relative w-full sm:w-[260px]">
            <input
              id="as-pw-current"
              type={showCurrentPw ? "text" : "password"}
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => onChangeCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full rounded-[9px] py-2 pl-3 pr-10 font-mono text-[0.82rem]"
              style={{
                backgroundColor: "var(--as-input-bg)",
                border: "1px solid var(--as-border)",
                color: "var(--as-text-primary)",
              }}
            />
            <button
              type="button"
              aria-label={showCurrentPw ? "Hide current password" : "Show current password"}
              onClick={() => setShowCurrentPw((v) => !v)}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md cursor-pointer"
              style={{ color: "var(--as-text-muted)" }}
            >
              {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* New Password + Strength Bar */}
        <div className="px-5 pt-3.5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-[13px]">
              <span
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{
                  backgroundColor: "rgba(var(--danger-rgb), 0.12)",
                  color: "var(--danger)",
                }}
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
              </span>
              <label
                htmlFor="as-pw-new"
                className="text-[0.88rem] font-semibold"
                style={{ color: "var(--as-text-primary)" }}
              >
                New Password
              </label>
            </div>
            <div className="relative w-full sm:w-[260px]">
              <input
                id="as-pw-new"
                type={showNewPw ? "text" : "password"}
                required
                maxLength={64}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => onChangeNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-[9px] py-2 pl-3 pr-10 font-mono text-[0.82rem]"
                style={{
                  backgroundColor: "var(--as-input-bg)",
                  border: "1px solid var(--as-border)",
                  color: "var(--as-text-primary)",
                }}
              />
              <button
                type="button"
                aria-label={showNewPw ? "Hide new password" : "Show new password"}
                onClick={() => setShowNewPw((v) => !v)}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md cursor-pointer"
                style={{ color: "var(--as-text-muted)" }}
              >
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pb-3.5 pt-2.5">
            <div
              className="h-1 flex-1 overflow-hidden rounded"
              style={{ backgroundColor: "var(--as-hover-bg)" }}
            >
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${pwStrengthPct}%`,
                  backgroundColor: pwStrengthColor,
                }}
              />
            </div>
            <span
              className="min-w-[60px] text-right text-[0.75rem] font-bold"
              style={{ color: pwStrengthColor }}
            >
              {pwStrengthLabel}
            </span>
          </div>
        </div>

        {/* Password Requirements Checklist */}
        <div
          className="px-5 pb-[18px] pt-3.5"
          style={{
            borderTop: "1px solid var(--as-border-subtle)",
            backgroundColor: "var(--as-card-subtle)",
          }}
        >
          <div
            className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--as-text-faint)" }}
          >
            All requirements must be met before saving · only letters, numbers and
            @$!%*?&amp;_#^ are allowed
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
                className="flex items-center gap-2 text-[0.77rem]"
                style={{
                  color: rule.met ? "var(--accent2)" : "var(--as-text-muted)",
                }}
              >
                <span
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                  style={
                    rule.met
                      ? {
                          backgroundColor: "rgba(var(--accent2-rgb), 0.2)",
                          border: "1.5px solid var(--accent2)",
                          color: "var(--accent2)",
                        }
                      : {
                          border: "1.5px solid var(--as-border)",
                          color: "transparent",
                        }
                  }
                >
                  <Check className="h-2.5 w-2.5" aria-hidden="true" />
                </span>
                <span>{rule.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Confirm New Password */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"
          style={{ borderTop: "1px solid var(--as-border-subtle)" }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-[13px]">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
              style={{
                backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                color: "var(--accent)",
              }}
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <label
                htmlFor="as-pw-confirm"
                className="block text-[0.88rem] font-semibold"
                style={{ color: "var(--as-text-primary)" }}
              >
                Confirm New Password
              </label>
              {confirmPassword.length > 0 && (
                <div
                  className="text-[0.75rem]"
                  style={{
                    color: pwMatches ? "var(--accent2)" : "var(--danger)",
                  }}
                >
                  {pwMatches ? "Passwords match" : "Passwords do not match"}
                </div>
              )}
            </div>
          </div>

          <div className="relative w-full sm:w-[260px]">
            <input
              id="as-pw-confirm"
              type={showConfirmPw ? "text" : "password"}
              required
              maxLength={64}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => onChangeConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full rounded-[9px] py-2 pl-3 pr-10 font-mono text-[0.82rem]"
              style={{
                backgroundColor: "var(--as-input-bg)",
                border: "1px solid var(--as-border)",
                color: "var(--as-text-primary)",
              }}
            />
            <button
              type="button"
              aria-label={showConfirmPw ? "Hide confirm password" : "Show confirm password"}
              onClick={() => setShowConfirmPw((v) => !v)}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md cursor-pointer"
              style={{ color: "var(--as-text-muted)" }}
            >
              {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Update Password Button */}
        <div
          className="flex justify-end px-5 py-3.5"
          style={{ borderTop: "1px solid var(--as-border)" }}
        >
          <button
            type="submit"
            disabled={savingPw || !currentPassword || !pwAllMet || !pwMatches}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 py-2 text-[0.78rem] font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: "rgba(var(--accent-rgb), 0.1)",
              border: "1px solid rgba(var(--accent-rgb), 0.2)",
              color: "var(--accent)",
            }}
          >
            {savingPw ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Update Password
          </button>
        </div>
      </form>
    </section>
  );
}
