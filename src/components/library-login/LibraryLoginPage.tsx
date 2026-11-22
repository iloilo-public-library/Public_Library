"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { useBookFlip } from "@/components/auth/useBookFlip";
import { LegalModal, type LegalModalType } from "@/components/landing/LegalModal";
import { useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LibraryTooltip } from "@/components/ui/tooltip";
import { DeskScene } from "./DeskScene";
import { Lamp } from "./Lamp";
import type { LoginCredentials, LoginResult } from "./LoginPage";
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
  const prefersReducedMotion = useReducedMotion();
  const isLight = theme === "light";

  const [lampOn, setLampOn] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);
  // Preserved login input state across Log In <-> Sign Up flips
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const bookFlip = useBookFlip();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLampOn(true);
    }, 260);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleLamp = () => setLampOn((prev) => !prev);

  return (
    <div className="ilpl" data-lamp={lampOn ? "on" : "off"}>
      <div className="ilpl-ambient-dim" aria-hidden="true" />
      <div className="ilpl-ambient-wash" aria-hidden="true" />

      {/* Reused landing-page floating books, papers, and globe (pointer-events: none, behind card) */}
      <LoginFloatingPropsCanvas />

      {/* Top Bar: ONE ThemeToggle, Browse Catalog, Log In (ghost/active), Sign Up (primary) */}
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
          <ThemeToggle className="h-10 w-10 md:h-9 md:w-9" />

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
            aria-current={bookFlip.activeMode === "login" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              bookFlip.switchMode("login");
            }}
            data-active={bookFlip.activeMode === "login" ? "true" : "false"}
            className="ilpl-nav-login"
          >
            Log In
          </Link>

          <button
            type="button"
            aria-pressed={bookFlip.activeMode === "signup"}
            onClick={() => bookFlip.switchMode("signup")}
            className="ilpl-nav-signup"
          >
            Sign Up
          </button>
        </nav>
      </header>

      {/* Main Split Stage: Lamp + Hero Copy (left) & Hologram + Funnel + Small Book (right) */}
      <main className="ilpl-main">
        <section aria-label="Welcome and interactive desk lamp" className="ilpl-left">
          <Lamp lampOn={lampOn} onToggle={toggleLamp} isLightTheme={isLight} />

          <div className="ilpl-hero">
            <motion.p
              className="ilpl-eyebrow"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              Republic of the Philippines &bull; City Government of Iloilo
            </motion.p>

            <motion.h1
              className="ilpl-title"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="block">Iloilo City</span>
              <span className="block">Public Library</span>
            </motion.h1>

            <motion.p
              className="ilpl-subtitle"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              Dr. Graciano Lopez Jaena Learning Resource Center &amp; Museum
            </motion.p>

            <motion.p
              className="ilpl-desc"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              Official public library portal for municipal catalog search, patron borrowing
              services, digital archives, and community records management.
            </motion.p>
          </div>
        </section>

        <section aria-label="Library hologram authentication portal" className="ilpl-right">
          <DeskScene
            bookFlip={bookFlip}
            loginEmail={loginEmail}
            loginPassword={loginPassword}
            onLoginEmailChange={setLoginEmail}
            onLoginPasswordChange={setLoginPassword}
            onLogin={onLogin}
            onOpenLegal={setLegalModal}
          />
        </section>
      </main>

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
}
