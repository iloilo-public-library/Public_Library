"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";
import { useTheme } from "@/components/theme-provider";
import { BookLoader } from "@/components/ui/book-loader";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { AuthCard, type AuthMode } from "./AuthCard";
import { Lamp } from "./Lamp";
import { LoginPage, type LoginCredentials, type LoginResult } from "./LoginPage";
import { SignUpPage } from "./SignUpPage";
import "./library-login.css";

const LoginFloatingPropsCanvas = dynamic(
  () =>
    import("@/components/shared/LoginFloatingPropsCanvas").then(
      (mod) => mod.LoginFloatingPropsCanvas
    ),
  { ssr: false }
);

export interface LibraryLoginPageProps {
  onLogin: (credentials: LoginCredentials) => Promise<LoginResult>;
}

export function LibraryLoginPage({ onLogin }: LibraryLoginPageProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [lampOn, setLampOn] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  // Shared single mode state driving top bar, card bottom link, sliding swap, headline roll, and expanding regions
  const [mode, setMode] = useState<AuthMode>("login");
  const [isSwapping, setIsSwapping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [signupToast, setSignupToast] = useState<string | null>(null);

  // Preserved login input state across Log In <-> Sign Up switches
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [externalSuccess, setExternalSuccess] = useState<string | null>(null);

  const loginRegionRef = useRef<HTMLDivElement>(null);
  const signupRegionRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setLampOn(true), 260);
    return () => {
      window.clearTimeout(timer);
      clearTimers();
    };
  }, [clearTimers]);

  // Keep collapsed form region inert so keyboard focus & screen readers never enter hidden controls
  useEffect(() => {
    if (loginRegionRef.current) {
      loginRegionRef.current.inert = mode !== "login";
    }
    if (signupRegionRef.current) {
      signupRegionRef.current.inert = mode !== "signup";
    }
  }, [mode]);

  const isBusy = isSwapping || isSubmitting;

  const switchMode = useCallback(
    (target: AuthMode) => {
      if (lockRef.current || isSubmitting || target === mode) return;

      clearTimers();
      lockRef.current = true;
      setIsSwapping(true);
      setMode(target);
      setAnnouncement(target === "signup" ? "Sign Up form" : "Log In form");

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const unlockMs = reduced ? 50 : 920;

      const unlock = () => {
        lockRef.current = false;
        setIsSwapping(false);
      };

      timersRef.current.push(
        window.setTimeout(unlock, unlockMs),
        window.setTimeout(unlock, 1500)
      );
    },
    [clearTimers, isSubmitting, mode]
  );

  const handleSignupSuccess = useCallback(
    (msg: string) => {
      setExternalSuccess(msg);
      setSignupToast(msg);
      setAnnouncement("Account created");
      timersRef.current.push(
        window.setTimeout(() => {
          setSignupToast(null);
          switchMode("login");
        }, 2000)
      );
    },
    [switchMode]
  );

  const toggleLamp = () => setLampOn((prev) => !prev);

  return (
    <div
      className="ilpl"
      data-lamp={lampOn ? "on" : "off"}
      data-mode={mode}
      data-swapping={isSwapping ? "true" : "false"}
    >
      <div className="ilpl-ambient-dim" aria-hidden="true" />
      <div className="ilpl-ambient-wash" aria-hidden="true" />

      {/* Top Bar: ONE ThemeToggle, Browse Catalog, Log In (outline/active), Sign Up (filled) */}
      <header className="ilpl-header">
        <Link href="/" className="ilpl-brand">
          <img
            src="/images/logo.png"
            alt="Iloilo City Public Library logo"
            className="h-8 w-8 shrink-0 rounded-lg object-cover lg:h-[34px] lg:w-[34px]"
          />
          <span className="truncate text-sm font-bold sm:text-base lg:text-[1.05rem]">
            Iloilo City Public Library
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="ilpl-header-actions">
          <LibraryTooltip label="Browse Catalog">
            <Link
              href="/browse"
              aria-label="Browse Catalog"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/6 text-[#f5cf7a] transition hover:border-[#f5cf7a]/45 hover:bg-[#f5cf7a]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5cf7a] md:hidden"
            >
              <BookOpen className="h-4 w-4" />
            </Link>
          </LibraryTooltip>
          <Link
            href="/browse"
            className="hidden rounded-full border border-white/15 bg-white/8 px-3.5 py-1.5 text-[0.82rem] font-semibold text-white/85 transition hover:bg-white/14 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5cf7a] md:inline-flex"
          >
            Browse Catalog
          </Link>

          <Link
            href="/login"
            aria-current={mode === "login" ? "page" : undefined}
            aria-disabled={isBusy}
            onClick={(e) => {
              e.preventDefault();
              switchMode("login");
            }}
            data-active={mode === "login" ? "true" : "false"}
            className="ilpl-nav-login"
          >
            Log In
          </Link>

          <button
            type="button"
            aria-disabled={isBusy}
            aria-pressed={mode === "signup"}
            data-active={mode === "signup" ? "true" : "false"}
            onClick={() => switchMode("signup")}
            className="ilpl-nav-signup"
          >
            Sign Up
          </button>
        </nav>
      </header>

      {/* Main Swapping Two-Column Stage: [Lamp + Floating Props + Hero Text] <-> [Auth Card] */}
      <main className="ilpl-main">
        {/* Unified Hero Panel (Lamp + Floating Props + Hero Text move together as one group!) */}
        <section aria-label="Library portal welcome and interactive desk lamp" className="ilpl-hero-col">
          {/* Floating globe, books & paper sheet framed around outer perimeter of hero panel */}
          <LoginFloatingPropsCanvas />

          <div className="ilpl-hero-group">
            {/* Lamp sits on the OUTER side of hero text (left in login, right & mirrored in sign-up) */}
            <div className="ilpl-lamp-mirror">
              <Lamp lampOn={lampOn} onToggle={toggleLamp} isLightTheme={isLight} />
            </div>

            <div className="ilpl-hero">
              <p className="ilpl-eyebrow">
                Republic of the Philippines &bull; City Government of Iloilo
              </p>
              <h1 className="ilpl-title">
                <span className="block">Iloilo City</span>
                <span className="block">Public Library</span>
              </h1>
              <p className="ilpl-subtitle">
                Dr. Graciano Lopez Jaena Learning Resource Center &amp; Museum
              </p>
              <p className="ilpl-desc">
                Official public library portal for municipal catalog search, patron borrowing
                services, digital archives, and community records management.
              </p>
            </div>
          </div>
        </section>

        {/* Auth Card Panel (slides to left column on sign-up, never covering the lamp) */}
        <section aria-label="Account authentication" className="ilpl-card-col">
          <AuthCard
            mode={mode}
            isBusy={isBusy}
            announcement={announcement}
            onModeChange={switchMode}
          >
            <div
              ref={loginRegionRef}
              className="ilpl-expand-region"
              data-open={mode === "login" ? "true" : "false"}
              aria-hidden={mode !== "login"}
            >
              <div className="ilpl-expand-inner">
                <LoginPage
                  email={loginEmail}
                  password={loginPassword}
                  onEmailChange={setLoginEmail}
                  onPasswordChange={setLoginPassword}
                  isActive={mode === "login"}
                  isBusy={isBusy}
                  onBusyChange={setIsSubmitting}
                  onAnnounce={setAnnouncement}
                  onLogin={onLogin}
                  externalSuccess={externalSuccess}
                  onClearExternalSuccess={() => setExternalSuccess(null)}
                />
              </div>
            </div>

            <div
              ref={signupRegionRef}
              className="ilpl-expand-region"
              data-open={mode === "signup" ? "true" : "false"}
              aria-hidden={mode !== "signup"}
            >
              <div className="ilpl-expand-inner">
                <SignUpPage
                  onSuccess={handleSignupSuccess}
                  onSwitchToLogin={() => switchMode("login")}
                  onOpenLegal={setLegalModal}
                />
              </div>
            </div>
          </AuthCard>
        </section>
      </main>

      {signupToast && (
        <div role="status" className="ilpl-toast">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0 text-[#48c78e]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12.5 L10 17.5 L19 7.5" className="ilpl-check-path" />
          </svg>
          <span>{signupToast}</span>
        </div>
      )}

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
      {isSubmitting && <BookLoader fullscreen label="Signing in" />}
    </div>
  );
}
