"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  QrCode,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Lamp } from "@/components/Lamp";
import { SignupWizard } from "@/components/auth/SignupWizard";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LibraryTooltip } from "@/components/ui/tooltip";

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const isLight = theme === "light";

  // Single state driving the lamp, light cone, ambient background glow, and welcome text
  const [lampOn, setLampOn] = useState(false);

  // Auth state & logic (Supabase + Neil's SignupWizard & LegalModal)
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  const switchMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
  };

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

  // Physically modeled inverse-square radial illumination gradients anchored at the lamp aperture
  const labelIllumGradient = isLight
    ? "radial-gradient(ellipse 140% 180% at 15% 30%, #a16207 0%, #854d0e 45%, #475569 100%)"
    : "radial-gradient(ellipse 140% 180% at 15% 30%, #FFFDF2 0%, #FFD27A 45%, rgba(255, 198, 107, 0.6) 100%)";

  const headingIllumGradient = isLight
    ? "radial-gradient(ellipse 130% 125% at 10% 16%, #422806 0%, #162a3e 38%, #0f1f2e 74%, rgba(15, 31, 46, 0.76) 100%)"
    : "radial-gradient(ellipse 130% 125% at 10% 16%, #FFFDF5 0%, #FFE9B8 28%, #E5D6BD 58%, rgba(218, 232, 245, 0.52) 100%)";

  const paragraphIllumGradient = isLight
    ? "radial-gradient(ellipse 125% 150% at 18% -15%, #3b2a14 0%, #243b53 50%, rgba(51, 78, 104, 0.68) 100%)"
    : "radial-gradient(ellipse 125% 150% at 18% -15%, #FFF4D6 0%, #E7D9C2 38%, rgba(218, 232, 245, 0.66) 74%, rgba(218, 232, 245, 0.36) 100%)";

  const litFilter = isLight
    ? "drop-shadow(0 0 10px rgba(255, 185, 80, 0.18))"
    : "drop-shadow(0 0 14px rgba(255, 210, 122, 0.34)) drop-shadow(4px 3px 26px rgba(255, 179, 71, 0.16))";

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-clip">
      {/* Darker ambient overlay while lamp is OFF */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-700 ease-out"
        style={{
          opacity: lampOn ? 0 : 1,
          background: isLight
            ? "radial-gradient(circle at 28% 44%, rgba(15, 31, 46, 0.08), rgba(15, 31, 46, 0.15) 72%)"
            : "radial-gradient(circle at 28% 44%, rgba(8, 15, 24, 0.44), rgba(6, 12, 20, 0.64) 74%)",
        }}
      />

      {/* Faint warm radial atmospheric light wash on page background while lamp is ON */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-700 ease-out ${
          lampOn ? "lamp-flicker-active" : ""
        }`}
        style={{
          opacity: lampOn ? 1 : 0,
          background: isLight
            ? "radial-gradient(ellipse 52% 48% at 32% 48%, rgba(255, 200, 102, 0.14), rgba(255, 179, 71, 0.05) 42%, transparent 72%)"
            : "radial-gradient(ellipse 52% 48% at 32% 48%, rgba(255, 206, 114, 0.15), rgba(255, 179, 71, 0.055) 42%, transparent 74%)",
        }}
      />

      {/* Sticky Compact Header on Mobile (<768px), Fixed 60px Topbar on Desktop (>=1024px) */}
      <header className="sticky top-0 z-[1100] flex min-h-14 w-full items-center justify-between gap-2 bg-[#2f3f4d]/95 px-4 pt-[env(safe-area-inset-top)] shadow-[0_2px_10px_rgba(0,0,0,0.3)] backdrop-blur-md lg:fixed lg:inset-x-0 lg:h-[60px] lg:min-h-0 lg:bg-[#2f3f4d] lg:px-10 lg:pt-0 lg:backdrop-blur-none">
        <Link
          href="/"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 text-white transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <img
            src="/images/logo.png"
            alt="Iloilo City Public Library logo"
            className="h-8 w-8 shrink-0 rounded-lg object-cover lg:h-[34px] lg:w-[34px]"
          />
          <span className="truncate text-base font-bold tracking-[-0.02em] lg:text-[1.05rem]">
            Iloilo City Public Library
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          {/* Mobile Browse Catalog Icon Button (44px tap target) */}
          <LibraryTooltip label="Browse Catalog">
            <Link
              href="/browse"
              aria-label="Browse Catalog"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/6 text-accent transition hover:border-accent/40 hover:bg-accent/15 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
            >
              <BookOpen className="h-[18px] w-[18px]" />
            </Link>
          </LibraryTooltip>

          <ThemeToggle className="h-11 w-11 md:h-9 md:w-9" />

          {/* Tablet/Desktop Browse Catalog Pill */}
          <Link
            href="/browse"
            className="hidden rounded-full border border-white/14 bg-white/8 px-3.5 py-1.5 text-[0.82rem] font-semibold text-white/80 transition hover:bg-white/14 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:inline-flex"
          >
            Browse Catalog
          </Link>
        </div>
      </header>

      {/* Main Content: Mobile-first compact stack -> Tablet centered stack -> Desktop 2-column split */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-1 flex-col justify-start pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-3 md:justify-center md:px-8 md:pb-12 md:pt-8 lg:min-h-[100dvh] lg:flex-row lg:items-center lg:px-12 lg:pb-12 lg:pt-[84px]">
        <div className="grid w-full grid-cols-1 items-center gap-4 md:gap-7 lg:grid-cols-12 lg:gap-10">
          {/* LEFT / TOP SECTION: Architect Lamp + Illuminated Welcome Copy */}
          <section
            aria-label="Welcome and interactive lamp"
            className="relative flex flex-col items-center px-4 md:px-0 lg:col-span-7 lg:items-start"
          >
            <div className="relative flex w-full flex-col items-center gap-1 text-center md:gap-2 lg:flex-row lg:items-center lg:gap-2 lg:text-left">
              {/* Architect Lamp Component */}
              <div className="shrink-0 -translate-x-2 md:-translate-x-3 lg:translate-x-0">
                <Lamp
                  lampOn={lampOn}
                  onToggle={() => setLampOn((prev) => !prev)}
                  isLightTheme={isLight}
                />
              </div>

              {/* Welcome Text Block — two-layer optical model (ambient shadow + inverse-square lit overlay) */}
              <div className="relative z-10 max-w-xs md:max-w-[440px] lg:pl-1 lg:pt-4">
                {/* Base Ambient Layer (dim when OFF, cool shadow fill when ON) */}
                <div
                  style={{
                    opacity: isLight ? 0.34 : 0.2,
                    color: isLight ? "#1e3a5f" : "#dae8f5",
                  }}
                >
                  <p className="text-[0.68rem] font-semibold uppercase tracking-widest md:text-[0.76rem] lg:text-[0.8rem] lg:tracking-[0.22em]">
                    Welcome to
                  </p>
                  <h1 className="mt-1 text-3xl font-bold leading-[1.08] tracking-[-0.03em] md:mt-2 md:text-4xl lg:mt-2.5 lg:text-[3.1rem] lg:leading-[1.06] xl:text-[3.55rem]">
                    <span className="inline lg:block">Iloilo Public </span>
                    <span className="inline lg:block">Library</span>
                  </h1>
                  <p className="mobile-hide-short mx-auto mt-1.5 line-clamp-2 max-w-xs text-sm leading-snug md:mt-3 md:line-clamp-none md:max-w-[40ch] md:text-[0.94rem] md:leading-[1.6] lg:mx-0 lg:mt-4 lg:text-[0.98rem] lg:leading-[1.68]">
                    Access the library management system to borrow books, manage records, and
                    explore resources available to the Iloilo City community.
                  </p>
                </div>

                {/* Illuminated Optical Overlay (inverse-square falloff from lamp aperture, smooth 700ms fade + turn-on flicker) */}
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 select-none transition-opacity duration-700 ease-out lg:pl-1 lg:pt-4 ${
                    lampOn ? "lamp-flicker-active opacity-100" : "opacity-0"
                  }`}
                  style={{ filter: litFilter }}
                >
                  <p
                    className="bg-clip-text text-[0.68rem] font-semibold uppercase tracking-widest text-transparent md:text-[0.76rem] lg:text-[0.8rem] lg:tracking-[0.22em]"
                    style={{ backgroundImage: labelIllumGradient }}
                  >
                    Welcome to
                  </p>
                  <div
                    className="mt-1 bg-clip-text text-3xl font-bold leading-[1.08] tracking-[-0.03em] text-transparent md:mt-2 md:text-4xl lg:mt-2.5 lg:text-[3.1rem] lg:leading-[1.06] xl:text-[3.55rem]"
                    style={{ backgroundImage: headingIllumGradient }}
                  >
                    <span className="inline lg:block">Iloilo Public </span>
                    <span className="inline lg:block">Library</span>
                  </div>
                  <p
                    className="mobile-hide-short mx-auto mt-1.5 line-clamp-2 max-w-xs bg-clip-text text-sm leading-snug text-transparent md:mt-3 md:line-clamp-none md:max-w-[40ch] md:text-[0.94rem] md:leading-[1.6] lg:mx-0 lg:mt-4 lg:text-[0.98rem] lg:leading-[1.68]"
                    style={{ backgroundImage: paragraphIllumGradient }}
                  >
                    Access the library management system to borrow books, manage records, and
                    explore resources available to the Iloilo City community.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT / BOTTOM SECTION: Single Glass Auth Card with Log In / Sign Up Tabs */}
          <section
            aria-label="Account authentication"
            className="flex w-full flex-col items-center lg:col-span-5 lg:items-end"
          >
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: "easeOut" }}
              className={`mx-4 w-[calc(100%-2rem)] rounded-3xl border border-white/10 bg-modal/95 p-5 shadow-[0_20px_54px_rgba(0,0,0,0.48)] backdrop-blur-md md:mx-0 md:w-full md:p-7 lg:rounded-[22px] lg:border-accent/20 lg:p-8 lg:shadow-[0_24px_72px_rgba(0,0,0,0.45)] ${
                mode === "signup"
                  ? "md:max-w-[560px] lg:max-w-[540px]"
                  : "md:max-w-md lg:max-w-[440px]"
              }`}
            >
              {/* In-Card Log In / Sign Up Tabs (h-11 / min 44px touch target) */}
              <div
                role="tablist"
                aria-label="Authentication mode"
                className="mb-4 grid grid-cols-2 rounded-xl border border-white/10 bg-bg1/75 p-1 lg:mb-6"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  onClick={() => switchMode("login")}
                  className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-modal lg:h-auto lg:py-2 lg:text-[0.84rem] ${
                    mode === "login"
                      ? "bg-accent text-on-accent shadow-sm"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  <LogIn className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                  Log In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signup"}
                  onClick={() => switchMode("signup")}
                  className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-modal lg:h-auto lg:py-2 lg:text-[0.84rem] ${
                    mode === "signup"
                      ? "bg-accent text-on-accent shadow-sm"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  <UserPlus className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                  Sign Up
                </button>
              </div>

              {/* Card Header (compact 40px shield on mobile) */}
              <div className="mb-4 text-center lg:mb-6">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-accent/25 bg-accent/12 text-accent lg:mb-3 lg:h-11 lg:w-11 lg:rounded-2xl">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold tracking-[-0.02em] text-white lg:text-[1.3rem]">
                  {mode === "login" ? "Welcome Back" : "Membership Registration"}
                </h2>
                <p className="mt-0.5 text-sm text-tl/75 lg:mt-1 lg:text-[0.82rem] lg:text-tl/70">
                  {mode === "login"
                    ? "Sign in with your Supabase-backed Iloilo Library account."
                    : "Complete all 3 steps to register your Iloilo City Public Library account."}
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/12 px-3.5 py-2.5 text-xs leading-relaxed text-danger"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="mb-4 flex items-start gap-2.5 rounded-xl border border-accent2/30 bg-accent2/12 px-3.5 py-2.5 text-xs leading-relaxed text-accent2"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {mode === "login" ? (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5 lg:space-y-4">
                  <div>
                    <label
                      htmlFor="auth-email"
                      className="mb-1.5 block text-xs font-semibold text-tl"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent/70" />
                      <input
                        id="auth-email"
                        type="email"
                        name="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="h-12 w-full rounded-xl border border-white/12 bg-bg1/80 pl-10 pr-4 text-base text-white placeholder:text-white/40 transition focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 lg:h-auto lg:py-2.5 lg:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label
                        htmlFor="auth-password"
                        className="block text-xs font-semibold text-tl"
                      >
                        Password
                      </label>
                      <Link
                        href="/reset-password"
                        className="text-[0.72rem] font-medium text-accent/85 transition hover:text-accent"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent/70" />
                      <input
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="h-12 w-full rounded-xl border border-white/12 bg-bg1/80 pl-10 pr-12 text-base text-white placeholder:text-white/40 transition focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 lg:h-auto lg:py-2.5 lg:pr-10 lg:text-sm"
                      />
                      <LibraryTooltip label={showPassword ? "Hide password" : "Show password"}>
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                          className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-white/55 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer lg:right-3 lg:h-auto lg:w-auto lg:p-0"
                        >
                          {showPassword ? (
                            <EyeOff className="h-[18px] w-[18px] lg:h-4 lg:w-4" />
                          ) : (
                            <Eye className="h-[18px] w-[18px] lg:h-4 lg:w-4" />
                          )}
                        </button>
                      </LibraryTooltip>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="accent"
                    size="lg"
                    disabled={loading}
                    className="h-12 w-full text-base font-semibold transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-modal lg:h-11 lg:text-sm"
                  >
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

              {/* Footer Row: 44px tap targets on mobile, QR Login as secondary pill button */}
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3.5 text-xs lg:mt-5 lg:border-white/8 lg:pt-4">
                <Link
                  href="/"
                  className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-white/70 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:ml-0 lg:min-h-0 lg:px-0 lg:text-white/55"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
                </Link>

                <div className="flex items-center gap-2.5 lg:gap-3">
                  <button
                    type="button"
                    onClick={() => setLegalModal("terms")}
                    className="min-h-[44px] rounded-lg px-2 text-tl/65 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer lg:min-h-0 lg:px-0"
                  >
                    Terms
                  </button>
                  <LibraryTooltip label="Quick login with mobile QR scanner">
                    <Link
                      href="/scan-qr"
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-4 font-semibold text-accent transition hover:bg-accent/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:min-h-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:hover:bg-transparent lg:hover:text-[#b8d4ec]"
                    >
                      <QrCode className="h-3.5 w-3.5" /> QR Login
                    </Link>
                  </LibraryTooltip>
                </div>
              </div>
            </motion.div>

            {/* Mobile Secondary Browse Catalog Button (reachable below the form as well as in the header) */}
            <div className="mt-3 flex w-full justify-center px-4 md:hidden">
              <Link
                href="/browse"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 px-5 text-sm font-medium text-tl/85 transition hover:border-accent/35 hover:bg-white/10 hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <BookOpen className="h-4 w-4 text-accent" />
                Browse Catalog
              </Link>
            </div>
          </section>
        </div>
      </main>

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
