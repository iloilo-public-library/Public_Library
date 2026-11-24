"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Lock, LogIn, Mail, QrCode } from "lucide-react";
import {
  FloatingField,
  MorphSubmitButton,
  PasswordEyeToggle,
  StatusBanner,
  type SubmitButtonState,
} from "./forms";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  redirectTo?: string;
  onCompleteRedirect?: () => void;
}

export interface LoginPageProps {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  isActive: boolean;
  isBusy: boolean;
  onBusyChange: (busy: boolean) => void;
  onAnnounce: (text: string) => void;
  onLogin: (credentials: LoginCredentials) => Promise<LoginResult>;
  externalSuccess: string | null;
  onClearExternalSuccess: () => void;
}

export function LoginPage({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  isActive,
  isBusy,
  onBusyChange,
  onAnnounce,
  onLogin,
  externalSuccess,
  onClearExternalSuccess,
}: LoginPageProps) {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitButtonState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isBusy || !isActive) return;

    // Basic presence check to focus first invalid field before hitting server Zod validation
    let hasLocalIssue = false;
    if (!email.trim()) {
      setEmailError("Email address is required.");
      hasLocalIssue = true;
    }
    if (!password) {
      setPasswordError("Password is required.");
      hasLocalIssue = true;
    }
    if (hasLocalIssue) {
      setShakeKey((k) => k + 1);
      setSubmitState("error");
      onAnnounce("Please complete the required fields.");
      if (!email.trim()) emailRef.current?.focus();
      else passwordRef.current?.focus();
      window.setTimeout(() => setSubmitState("idle"), 420);
      return;
    }

    submittingRef.current = true;
    onBusyChange(true);
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    onClearExternalSuccess();
    setSubmitState("loading");
    onAnnounce("Signing in");

    try {
      const result = await onLogin({ email, password });

      if (!result.ok) {
        const msg = result.error || "Authentication failed. Please try again.";
        setError(msg);
        // Surface field-level invalid cue when server reports credential/email/password error
        if (/email/i.test(msg)) {
          setEmailError(msg);
          emailRef.current?.focus();
        } else {
          setPasswordError(msg);
          passwordRef.current?.focus();
        }
        setShakeKey((k) => k + 1);
        setSubmitState("error");
        onAnnounce(msg);
        window.setTimeout(() => setSubmitState("idle"), 420);
        submittingRef.current = false;
        onBusyChange(false);
        return;
      }

      onAnnounce("Signed in");
      result.onCompleteRedirect?.();
    } catch {
      const msg = "Network error while connecting to authentication.";
      setError(msg);
      setShakeKey((k) => k + 1);
      setSubmitState("error");
      onAnnounce(msg);
      window.setTimeout(() => setSubmitState("idle"), 420);
      submittingRef.current = false;
      onBusyChange(false);
    }
  };

  return (
    <div id="ilpl-panel-login">
      <StatusBanner error={error} success={externalSuccess} />

      <form onSubmit={handleSubmit} className="ilpl-form-fields" noValidate>
        <FloatingField
          ref={emailRef}
          id="ilpl-login-email"
          label="Email Address"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={!isActive}
          value={email}
          error={emailError}
          shakeKey={shakeKey}
          onChange={(e) => {
            onEmailChange(e.target.value);
            if (emailError) setEmailError(null);
            if (error) setError(null);
          }}
          icon={<Mail className="h-5 w-5" />}
        />

        <div>
          <FloatingField
            ref={passwordRef}
            id="ilpl-login-password"
            label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            disabled={!isActive}
            value={password}
            error={passwordError}
            shakeKey={shakeKey}
            onChange={(e) => {
              onPasswordChange(e.target.value);
              if (passwordError) setPasswordError(null);
              if (error) setError(null);
            }}
            icon={<Lock className="h-5 w-5" />}
            rightSlot={
              <PasswordEyeToggle
                shown={showPassword}
                disabled={!isActive}
                onToggle={() => setShowPassword((prev) => !prev)}
              />
            }
          />
          <div className="mt-1.5 flex justify-end">
            <Link
              href="/reset-password"
              tabIndex={isActive ? 0 : -1}
              className="rounded text-[0.875rem] font-semibold text-[#f5cf7a] underline-offset-2 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5cf7a]"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <div className="pt-1">
          <MorphSubmitButton
            state={submitState === "error" ? "error" : "idle"}
            locked={isBusy || !isActive}
            idleLabel="Sign In"
            shakeKey={shakeKey}
            icon={<LogIn className="h-5 w-5" />}
          />
        </div>
      </form>

      {/* Bottom link (QR Login) */}
      <div className="ilpl-card-footer !justify-center">
        <Link
          href="/scan-qr"
          tabIndex={isActive ? 0 : -1}
          className="ilpl-footer-link ilpl-footer-link-accent"
        >
          <QrCode className="h-4 w-4" />
          QR Login
        </Link>
      </div>
    </div>
  );
}
