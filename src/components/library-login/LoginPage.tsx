"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
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
  captcha_token: string;
}

export interface LoginNotice {
  kind: "success" | "warning";
  title?: string;
  message: string;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  pendingApproval?: boolean;
  mfaRequired?: boolean;
  mfaMethods?: ("otp" | "pin")[];
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
  onMfaComplete?: (redirectUrl?: string) => void;
  initialNotice?: LoginNotice | null;
  externalSuccess: string | null;
  onClearExternalSuccess: () => void;
}

const RESEND_COOLDOWN_SEC = 60;

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
  onMfaComplete,
  initialNotice = null,
  externalSuccess,
  onClearExternalSuccess,
}: LoginPageProps) {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const captchaRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitButtonState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<LoginNotice | null>(initialNotice);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  // CAPTCHA state
  const [captchaQuestion, setCaptchaQuestion] = useState<string>("");
  const [captchaChallengeToken, setCaptchaChallengeToken] = useState<string>("");
  const [captchaAnswer, setCaptchaAnswer] = useState<string>("");
  const [captchaLoading, setCaptchaLoading] = useState<boolean>(false);

  // MFA challenge state ("otp" -> "pin")
  const [mfaStep, setMfaStep] = useState<"otp" | "pin" | null>(null);
  const [mfaMethods, setMfaMethods] = useState<("otp" | "pin")[]>([]);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [pinCode, setPinCode] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendingOtp, setResendingOtp] = useState(false);

  useEffect(() => {
    setNotice(initialNotice);
  }, [initialNotice]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const loadCaptchaChallenge = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const res = await fetch("/api/auth/verify-captcha", { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        question?: string;
        token?: string;
      };
      if (res.ok && data.ok && data.question && data.token) {
        setCaptchaQuestion(data.question);
        setCaptchaChallengeToken(data.token);
      } else {
        setCaptchaQuestion("");
        setCaptchaChallengeToken("");
      }
    } catch {
      setCaptchaQuestion("");
      setCaptchaChallengeToken("");
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !mfaStep && !captchaChallengeToken) {
      void loadCaptchaChallenge();
    }
  }, [isActive, mfaStep, captchaChallengeToken, loadCaptchaChallenge]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  useEffect(() => {
    if (mfaStep === "otp") {
      window.setTimeout(() => otpRef.current?.focus(), 60);
    } else if (mfaStep === "pin") {
      window.setTimeout(() => pinRef.current?.focus(), 60);
    }
  }, [mfaStep]);

  const triggerErrorAnimation = (msg: string) => {
    setShakeKey((k) => k + 1);
    setSubmitState("error");
    onAnnounce(msg);
    window.setTimeout(() => setSubmitState("idle"), 420);
  };

  const resetMfaToCredentials = (message?: string) => {
    setMfaStep(null);
    setMfaMethods([]);
    setOtpCode("");
    setOtpError(null);
    setPinCode("");
    setPinError(null);
    setShowPin(false);
    setResendCooldown(0);
    setCaptchaAnswer("");
    setCaptchaError(null);
    setError(message || null);
    void loadCaptchaChallenge();
  };

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
    if (!captchaAnswer.trim()) {
      setCaptchaError("Please solve the security check.");
      hasLocalIssue = true;
    }
    if (hasLocalIssue) {
      triggerErrorAnimation("Please complete the required fields.");
      if (!email.trim()) emailRef.current?.focus();
      else if (!password) passwordRef.current?.focus();
      else captchaRef.current?.focus();
      return;
    }

    if (!captchaChallengeToken) {
      setCaptchaError("Security check expired. Refreshing...");
      triggerErrorAnimation("Security check expired. Please try again.");
      void loadCaptchaChallenge();
      return;
    }

    submittingRef.current = true;
    onBusyChange(true);
    setError(null);
    setNotice(null);
    setEmailError(null);
    setPasswordError(null);
    setCaptchaError(null);
    onClearExternalSuccess();
    setSubmitState("loading");
    onAnnounce("Verifying security check");

    try {
      // Step 1: Verify single-use CAPTCHA
      const captchaRes = await fetch("/api/auth/verify-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: captchaChallengeToken,
          answer: captchaAnswer.trim(),
        }),
      });
      const captchaData = (await captchaRes.json()) as {
        ok?: boolean;
        captcha_token?: string;
        error?: string;
      };

      if (!captchaRes.ok || !captchaData.ok || !captchaData.captcha_token) {
        const msg = captchaData.error || "Incorrect security check answer. Please try again.";
        setError(msg);
        setCaptchaError(msg);
        setCaptchaAnswer("");
        void loadCaptchaChallenge();
        captchaRef.current?.focus();
        triggerErrorAnimation(msg);
        submittingRef.current = false;
        onBusyChange(false);
        return;
      }

      onAnnounce("Signing in");

      // Step 2: Authenticate credentials with single-use captcha_token
      const result = await onLogin({
        email,
        password,
        captcha_token: captchaData.captcha_token,
      });

      if (!result.ok) {
        const msg = result.error || "Authentication failed. Please try again.";
        setCaptchaAnswer("");
        void loadCaptchaChallenge();

        if (result.pendingApproval) {
          setNotice({
            kind: "warning",
            title: "Account Pending Approval",
            message: msg,
          });
          setError(null);
        } else {
          setError(msg);
          if (/captcha/i.test(msg)) {
            setCaptchaError(msg);
            captchaRef.current?.focus();
          } else if (/email/i.test(msg)) {
            setEmailError(msg);
            emailRef.current?.focus();
          } else {
            setPasswordError(msg);
            passwordRef.current?.focus();
          }
        }

        triggerErrorAnimation(msg);
        submittingRef.current = false;
        onBusyChange(false);
        return;
      }

      if (result.mfaRequired) {
        const methods = result.mfaMethods?.length ? result.mfaMethods : (["otp"] as ("otp" | "pin")[]);
        const firstStep = methods[0];
        setMfaMethods(methods);
        setMfaStep(firstStep);
        setOtpCode("");
        setOtpError(null);
        setPinCode("");
        setPinError(null);
        setSubmitState("idle");
        if (firstStep === "otp") {
          setResendCooldown(RESEND_COOLDOWN_SEC);
          setNotice({
            kind: "success",
            title: "Verification Code Sent",
            message: "We sent a 6-character security code to your registered email address.",
          });
          onAnnounce("Enter verification code sent to your email");
        } else {
          setNotice(null);
          onAnnounce("Enter your 6-digit security PIN");
        }
        submittingRef.current = false;
        onBusyChange(false);
        return;
      }

      onAnnounce("Signed in");
      result.onCompleteRedirect?.();
    } catch {
      const msg = "Network error while connecting to authentication.";
      setError(msg);
      setCaptchaAnswer("");
      void loadCaptchaChallenge();
      triggerErrorAnimation(msg);
      submittingRef.current = false;
      onBusyChange(false);
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isBusy || !isActive || mfaStep !== "otp") return;

    const candidate = otpCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(candidate)) {
      const msg = "Please enter the 6-character verification code.";
      setOtpError(msg);
      otpRef.current?.focus();
      triggerErrorAnimation(msg);
      return;
    }

    submittingRef.current = true;
    onBusyChange(true);
    setError(null);
    setOtpError(null);
    setSubmitState("loading");
    onAnnounce("Verifying code");

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: candidate }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        verified?: boolean;
        mfa_required?: boolean;
        methods?: ("otp" | "pin")[];
        redirectUrl?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        const msg = data.error || "Invalid verification code.";
        if (res.status === 401) {
          resetMfaToCredentials(msg);
        } else {
          setError(msg);
          setOtpError(msg);
          otpRef.current?.focus();
        }
        triggerErrorAnimation(msg);
        submittingRef.current = false;
        onBusyChange(false);
        return;
      }

      if (data.mfa_required || data.methods?.includes("pin")) {
        setMfaMethods(data.methods || ["pin"]);
        setMfaStep("pin");
        setOtpCode("");
        setOtpError(null);
        setPinCode("");
        setPinError(null);
        setSubmitState("idle");
        setNotice({
          kind: "success",
          title: "Email Code Verified",
          message: "Please enter your 6-digit security PIN to finish signing in.",
        });
        onAnnounce("Email code verified. Enter your 6-digit security PIN.");
        submittingRef.current = false;
        onBusyChange(false);
        return;
      }

      onAnnounce("Signed in");
      onMfaComplete?.(data.redirectUrl);
    } catch {
      const msg = "Network error while verifying code.";
      setError(msg);
      triggerErrorAnimation(msg);
      submittingRef.current = false;
      onBusyChange(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendingOtp || resendCooldown > 0 || isBusy || mfaStep !== "otp") return;
    setResendingOtp(true);
    setError(null);
    setOtpError(null);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) {
        const msg = data.error || "Unable to resend verification code.";
        if (res.status === 401) {
          resetMfaToCredentials(msg);
        } else {
          setError(msg);
        }
        onAnnounce(msg);
        return;
      }
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setNotice({
        kind: "success",
        title: "Code Resent",
        message: data.message || "A new verification code was sent to your email.",
      });
      onAnnounce("A new verification code was sent to your email.");
    } catch {
      setError("Network error while resending verification code.");
    } finally {
      setResendingOtp(false);
    }
  };

  const handlePinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isBusy || !isActive || mfaStep !== "pin") return;

    const candidate = pinCode.trim();
    if (!/^\d{6}$/.test(candidate)) {
      const msg = "PIN must be exactly 6 digits.";
      setPinError(msg);
      pinRef.current?.focus();
      triggerErrorAnimation(msg);
      return;
    }

    submittingRef.current = true;
    onBusyChange(true);
    setError(null);
    setPinError(null);
    setSubmitState("loading");
    onAnnounce("Verifying security PIN");

    try {
      const res = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: candidate }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        verified?: boolean;
        redirectUrl?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        const msg = data.error || "Incorrect security PIN.";
        if (res.status === 401) {
          resetMfaToCredentials(msg);
        } else if (/expired/i.test(msg)) {
          resetMfaToCredentials();
          setNotice({
            kind: "warning",
            title: "Security PIN Expired",
            message: msg,
          });
        } else {
          setError(msg);
          setPinError(msg);
          pinRef.current?.focus();
        }
        triggerErrorAnimation(msg);
        submittingRef.current = false;
        onBusyChange(false);
        return;
      }

      onAnnounce("Signed in");
      onMfaComplete?.(data.redirectUrl);
    } catch {
      const msg = "Network error while verifying PIN.";
      setError(msg);
      triggerErrorAnimation(msg);
      submittingRef.current = false;
      onBusyChange(false);
    }
  };

  const noticeBanner = notice ? (
    <div
      role="status"
      className={`mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-snug ${
        notice.kind === "warning"
          ? "border-[#f5cf7a]/45 bg-[#33270d]/90 text-[#fde68a]"
          : "border-[#48c78e]/45 bg-[#0e2e23]/90 text-[#bbf7d0]"
      }`}
    >
      {notice.kind === "warning" ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <div>
        {notice.title && <div className="font-semibold">{notice.title}</div>}
        <div>{notice.message}</div>
      </div>
    </div>
  ) : null;

  if (mfaStep === "otp") {
    return (
      <div id="ilpl-panel-login">
        <StatusBanner error={error} success={null} />
        {noticeBanner}

        <div className="mb-3 flex items-center justify-between text-xs text-[#c2d4e7]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#f5cf7a]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Step 1 of {mfaMethods.includes("pin") ? 2 : 1}: Email Verification
          </span>
        </div>

        <form onSubmit={handleOtpSubmit} className="ilpl-form-fields" noValidate>
          <FloatingField
            ref={otpRef}
            id="ilpl-login-otp"
            label="6-Character Verification Code"
            type="text"
            name="otp"
            inputMode="text"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            maxLength={6}
            required
            disabled={!isActive}
            value={otpCode}
            error={otpError}
            shakeKey={shakeKey}
            onChange={(e) => {
              setOtpCode(e.target.value.toUpperCase().slice(0, 6));
              if (otpError) setOtpError(null);
              if (error) setError(null);
            }}
            icon={<KeyRound className="h-5 w-5" />}
          />

          <div className="pt-1">
            <MorphSubmitButton
              state={submitState === "error" ? "error" : "idle"}
              locked={isBusy || !isActive}
              idleLabel="Verify Code"
              shakeKey={shakeKey}
              icon={<ShieldCheck className="h-5 w-5" />}
            />
          </div>
        </form>

        <div className="ilpl-card-footer">
          <button
            type="button"
            disabled={!isActive || resendingOtp || resendCooldown > 0}
            onClick={() => void handleResendOtp()}
            className="ilpl-footer-link ilpl-footer-link-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${resendingOtp ? "animate-spin" : ""}`} />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
          </button>
          <button
            type="button"
            disabled={!isActive || isBusy}
            onClick={() => resetMfaToCredentials()}
            className="ilpl-footer-link"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (mfaStep === "pin") {
    return (
      <div id="ilpl-panel-login">
        <StatusBanner error={error} success={null} />
        {noticeBanner}

        <div className="mb-3 flex items-center justify-between text-xs text-[#c2d4e7]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#f5cf7a]">
            <Lock className="h-4 w-4" aria-hidden="true" />
            {mfaMethods.includes("otp") ? "Step 2 of 2: Security PIN" : "Security PIN Required"}
          </span>
        </div>

        <form onSubmit={handlePinSubmit} className="ilpl-form-fields" noValidate>
          <FloatingField
            ref={pinRef}
            id="ilpl-login-pin"
            label="6-Digit Security PIN"
            type={showPin ? "text" : "password"}
            name="pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            disabled={!isActive}
            value={pinCode}
            error={pinError}
            shakeKey={shakeKey}
            onChange={(e) => {
              setPinCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              if (pinError) setPinError(null);
              if (error) setError(null);
            }}
            icon={<KeyRound className="h-5 w-5" />}
            rightSlot={
              <PasswordEyeToggle
                shown={showPin}
                disabled={!isActive}
                onToggle={() => setShowPin((prev) => !prev)}
              />
            }
          />

          <div className="mt-1.5 flex justify-end">
            <Link
              href="/reset-pin"
              tabIndex={isActive ? 0 : -1}
              className="rounded text-[0.875rem] font-semibold text-[#f5cf7a] underline-offset-2 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5cf7a]"
            >
              Forgot PIN?
            </Link>
          </div>

          <div className="pt-1">
            <MorphSubmitButton
              state={submitState === "error" ? "error" : "idle"}
              locked={isBusy || !isActive}
              idleLabel="Verify PIN"
              shakeKey={shakeKey}
              icon={<ShieldCheck className="h-5 w-5" />}
            />
          </div>
        </form>

        <div className="ilpl-card-footer !justify-center">
          <button
            type="button"
            disabled={!isActive || isBusy}
            onClick={() => resetMfaToCredentials()}
            className="ilpl-footer-link"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="ilpl-panel-login">
      <StatusBanner error={error} success={externalSuccess} />
      {!externalSuccess && noticeBanner}

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
            if (notice) setNotice(null);
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
              if (notice) setNotice(null);
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

        {/* Security Check (CAPTCHA) */}
        <div className="rounded-xl border border-white/14 bg-white/[0.04] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label
              htmlFor="ilpl-login-captcha"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#c2d4e7]"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#f5cf7a]" aria-hidden="true" />
              Security Check
            </label>
            <button
              type="button"
              disabled={!isActive || captchaLoading}
              onClick={() => {
                setCaptchaAnswer("");
                setCaptchaError(null);
                void loadCaptchaChallenge();
              }}
              aria-label="Refresh security check"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-[#9fc3ea] transition hover:text-[#f5cf7a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5cf7a] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${captchaLoading ? "animate-spin" : ""}`} />
              New
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex min-h-[44px] min-w-[98px] shrink-0 items-center justify-center rounded-lg border border-[#f5cf7a]/30 bg-[#101c2a] px-3 font-mono text-sm font-bold tracking-wide text-[#f5cf7a]"
              aria-live="polite"
            >
              {captchaLoading ? "..." : captchaQuestion || "—"}
            </span>
            <input
              ref={captchaRef}
              id="ilpl-login-captcha"
              type="text"
              inputMode="numeric"
              name="captcha_answer"
              autoComplete="off"
              required
              disabled={!isActive}
              aria-label="Security check answer"
              aria-invalid={Boolean(captchaError) || undefined}
              aria-describedby={captchaError ? "ilpl-login-captcha-error" : undefined}
              placeholder="Answer"
              value={captchaAnswer}
              onChange={(e) => {
                setCaptchaAnswer(e.target.value);
                if (captchaError) setCaptchaError(null);
                if (error) setError(null);
              }}
              className={`min-h-[44px] w-full rounded-lg border bg-[#101c2a] px-3 text-base text-[#f4f8fd] placeholder:text-[#9fc3ea]/50 focus:outline-none focus:ring-2 focus:ring-[#f5cf7a] ${
                captchaError ? "border-[#ff6b6b]" : "border-white/15"
              }`}
            />
          </div>
          {captchaError && (
            <p id="ilpl-login-captcha-error" role="alert" className="ilpl-field-error">
              {captchaError}
            </p>
          )}
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
