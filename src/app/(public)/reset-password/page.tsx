"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleRequestLink = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        setFeedback({ ok: false, msg: data.error || "Unable to send reset link." });
      } else {
        setFeedback({
          ok: true,
          msg: data.message || "If an account exists, a password reset link has been sent.",
        });
        setEmail("");
      }
    } catch {
      setFeedback({ ok: false, msg: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        setFeedback({ ok: false, msg: data.error || "Password reset failed." });
      } else {
        setFeedback({
          ok: true,
          msg: data.message || "Password updated. Redirecting to login...",
        });
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => router.push("/login"), 1800);
      }
    } catch {
      setFeedback({ ok: false, msg: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-white/10 bg-modal/90 p-6 shadow-2xl backdrop-blur-md sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/15 text-accent">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              {token ? "Set New Password" : "Reset Password"}
            </h1>
            <p className="text-xs text-tl/75">
              {token
                ? "Choose a strong new password for your account."
                : "Enter your email to receive a password reset link."}
            </p>
          </div>
        </div>

        {feedback && (
          <div
            className={`mb-5 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${
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

        {token ? (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold text-tl">
                New Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent/70" />
                <input
                  id="new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars + upper/lower/num/symbol"
                  className="w-full rounded-xl border border-white/12 bg-bg1/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block text-xs font-semibold text-tl"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent/70" />
                <input
                  id="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full rounded-xl border border-white/12 bg-bg1/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <Button type="submit" variant="accent" size="lg" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRequestLink} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="mb-1.5 block text-xs font-semibold text-tl">
                Account Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent/70" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-white/12 bg-bg1/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <Button type="submit" variant="accent" size="lg" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-4 text-xs">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-white/65 transition hover:text-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
          </Link>
          <Link href="/reset-pin" className="text-tl/70 transition hover:text-accent">
            Reset PIN instead
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center text-xs text-tl">
          Loading...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
