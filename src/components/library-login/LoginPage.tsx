"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, Mail, QrCode } from "lucide-react";
import type { LegalModalType } from "@/components/landing/LegalModal";
import { HoloField, HoloSubmit, StatusBanner } from "./forms";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export interface LoginPageProps {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  disabled?: boolean;
  onLogin: (credentials: LoginCredentials) => Promise<LoginResult>;
  onOpenLegal: (type: LegalModalType) => void;
  onRouteFlip: (onNavigate: () => void, label: string) => void;
  externalSuccess: string | null;
  onClearExternalSuccess: () => void;
}

export function LoginPage({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  disabled = false,
  onLogin,
  onOpenLegal,
  onRouteFlip,
  externalSuccess,
  onClearExternalSuccess,
}: LoginPageProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    setError(null);
    onClearExternalSuccess();
    setLoading(true);

    try {
      const result = await onLogin({ email, password });
      if (!result.ok) {
        setError(result.error || "Authentication failed. Please try again.");
        setLoading(false);
        return;
      }
      setSucceeded(true);
    } catch {
      setError("Network error while connecting to authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-[#9fc3ea]">
          Official Portal Access
        </p>
        <h2 className="ilpl-holo-title mt-0.5">Patron &amp; Staff Sign In</h2>
        <p className="ilpl-holo-sub">
          Enter your registered credentials to access Iloilo City Public Library services.
        </p>
      </div>

      <StatusBanner error={error} success={externalSuccess} />

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <HoloField
          id="ilpl-login-email"
          label="Email Address"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={disabled}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="name@example.com"
          icon={<Mail className="h-4 w-4" />}
        />

        <HoloField
          id="ilpl-login-password"
          label="Password"
          type={showPassword ? "text" : "password"}
          name="password"
          autoComplete="current-password"
          required
          disabled={disabled}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Enter your password"
          icon={<Lock className="h-4 w-4" />}
          labelAction={
            <Link
              href="/reset-password"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onRouteFlip(() => router.push("/reset-password"), "Forgot password");
              }}
              className="text-xs font-semibold text-[#f5cf7a]/90 underline-offset-2 transition hover:text-[#f5cf7a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5cf7a]"
            >
              Forgot password?
            </Link>
          }
          rightSlot={
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-[#9db4cc] transition hover:text-[#e8f1fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5cf7a] cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <div className="pt-1">
          <HoloSubmit
            loading={loading || disabled}
            succeeded={succeeded}
            idleLabel="Sign In"
            loadingLabel={disabled ? "Sign In" : "Connecting..."}
            successLabel="Portal Unlocked"
            icon={<LogIn className="h-4 w-4" />}
          />
        </div>
      </form>

      {/* Preserved footer links: Back to Home, Terms, QR Login */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f5cf7a]/18 pt-2 text-xs">
        <Link
          href="/"
          className="inline-flex min-h-[40px] items-center gap-1 font-medium text-[#b6cadf] transition hover:text-[#f5cf7a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5cf7a]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onOpenLegal("terms")}
            className="min-h-[40px] px-1 font-medium text-[#b6cadf] transition hover:text-[#f5cf7a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5cf7a] cursor-pointer"
          >
            Terms
          </button>
          <Link
            href="/scan-qr"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              onRouteFlip(() => router.push("/scan-qr"), "QR Login");
            }}
            className="inline-flex min-h-[40px] items-center gap-1 font-semibold text-[#9fc3ea] transition hover:text-[#f5cf7a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5cf7a]"
          >
            <QrCode className="h-3.5 w-3.5" />
            QR Login
          </Link>
        </div>
      </div>
    </div>
  );
}
