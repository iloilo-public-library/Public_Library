"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SignupWizard } from "@/components/auth/SignupWizard";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        redirectTo?: string;
      };

      if (!res.ok || !data.ok) {
        setError(data.error || "Authentication failed. Please try again.");
        setLoading(false);
        return;
      }

      if (data.redirectTo) {
        router.push(data.redirectTo);
        router.refresh();
      }
    } catch {
      setError("Network error while connecting to Supabase authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Topbar Strip */}
      <header className="fixed inset-x-0 top-0 z-[1100] flex h-[60px] items-center justify-between bg-[#2f3f4d] px-4 shadow-[0_2px_10px_rgba(0,0,0,0.3)] md:px-10">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 text-white transition hover:opacity-85"
        >
          <img
            src="/static/images/logo.png"
            alt="Logo"
            className="h-[34px] w-[34px] shrink-0 rounded-lg object-cover"
          />
          <span className="truncate text-[1.05rem] font-bold tracking-[-0.02em]">
            Iloilo City Public Library
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
              setSuccess(null);
            }}
            className={`rounded-full border px-4 py-1.5 text-[0.83rem] font-semibold transition cursor-pointer ${
              mode === "login"
                ? "border-accent bg-accent text-on-accent"
                : "border-white/14 bg-white/8 text-white/75 hover:bg-white/14 hover:text-white"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
              setSuccess(null);
            }}
            className={`rounded-full border px-4 py-1.5 text-[0.83rem] font-semibold transition cursor-pointer ${
              mode === "signup"
                ? "border-accent bg-accent text-on-accent"
                : "border-white/14 bg-white/8 text-white/75 hover:bg-white/14 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* Centered Auth Card */}
      <main className="flex min-h-screen items-center justify-center px-4 pb-10 pt-[88px]">
        <motion.div
          layout
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
          className={`w-full rounded-[22px] border border-accent/20 bg-modal/95 p-7 shadow-[0_24px_72px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-8 ${
            mode === "signup" ? "max-w-[560px]" : "max-w-[440px]"
          }`}
        >
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/12 text-accent">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-[1.35rem] font-bold tracking-[-0.02em] text-white">
              {mode === "login" ? "Welcome Back" : "Membership Registration"}
            </h1>
            <p className="mt-1 text-[0.82rem] text-tl/70">
              {mode === "login"
                ? "Sign in with your Supabase-backed Iloilo Library account."
                : "Complete all 3 steps to register your Iloilo City Public Library account."}
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/12 px-3.5 py-2.5 text-xs leading-relaxed text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-accent2/30 bg-accent2/12 px-3.5 py-2.5 text-xs leading-relaxed text-accent2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-tl">Email Address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent/65" />
                  <input
                    type="email"
                    name="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-white/12 bg-bg1/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-tl/45 focus:border-accent/55 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-tl">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent/65" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-white/12 bg-bg1/80 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-tl/45 focus:border-accent/55 focus:outline-none"
                  />
                  <LibraryTooltip label={showPassword ? "Hide password" : "Show password"}>
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </LibraryTooltip>
                </div>
              </div>

              <Button type="submit" variant="accent" size="lg" disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {loading ? "Connecting..." : "Log In"}
              </Button>
            </form>
          ) : (
            <SignupWizard
              onSuccess={(msg) => {
                setError(null);
                setSuccess(msg);
                setMode("login");
              }}
              onError={setError}
              onSwitchToLogin={() => {
                setMode("login");
                setError(null);
              }}
              onOpenLegal={(type) => setLegalModal(type)}
            />
          )}

          <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4 text-xs">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-white/55 transition hover:text-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
            </Link>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLegalModal("terms")}
                className="text-tl/60 transition hover:text-accent cursor-pointer"
              >
                Terms
              </button>
              <LibraryTooltip label="Quick login with mobile QR scanner">
                <Link
                  href="/scan-qr"
                  className="inline-flex items-center gap-1.5 font-semibold text-accent transition hover:text-[#b8d4ec]"
                >
                  <QrCode className="h-3.5 w-3.5" /> QR Login
                </Link>
              </LibraryTooltip>
            </div>
          </div>
        </motion.div>
      </main>

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
