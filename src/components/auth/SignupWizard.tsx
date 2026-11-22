"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FileUp,
  IdCard,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LibraryTooltip } from "@/components/ui/tooltip";
import type { LegalModalType } from "@/components/landing/LegalModal";

const EDUCATION_LEVELS = [
  "Elementary",
  "Junior High School",
  "Senior High School",
  "Vocational/Technical",
  "College",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctorate",
  "Postdoctoral",
  "Others",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ACCEPTED_ID_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_ID_BYTES = 5 * 1024 * 1024;

interface SignupWizardProps {
  onSuccess: (message: string) => void;
  onError: (error: string | null) => void;
  onSwitchToLogin?: () => void;
  onOpenLegal: (type: LegalModalType) => void;
}

export function SignupWizard({
  onSuccess,
  onError,
  onOpenLegal,
}: SignupWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1 — Personal
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"" | "Male" | "Female" | "Others">("");
  const [school, setSchool] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [occupation, setOccupation] = useState("");

  // Step 2 — Documents & Affiliation
  const [isGovernment, setIsGovernment] = useState(false);
  const [officePhone, setOfficePhone] = useState("");
  const [validIdName, setValidIdName] = useState("");
  const [validIdSizeLabel, setValidIdSizeLabel] = useState("");

  // Step 3 — Account & Security
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Live email availability check
  const [emailStatus, setEmailStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    reason: string;
  }>({ checking: false, available: null, reason: "" });

  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setEmailStatus({ checking: false, available: null, reason: "" });
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setEmailStatus({
        checking: false,
        available: false,
        reason: "Enter a valid email address.",
      });
      return;
    }

    const controller = new AbortController();
    setEmailStatus({ checking: true, available: null, reason: "Checking availability..." });

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/check_email?email=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        const data = (await res.json()) as {
          available?: boolean;
          taken?: boolean;
          reason?: string;
        };
        setEmailStatus({
          checking: false,
          available: Boolean(data.available),
          reason:
            data.reason ||
            (data.available ? "Email is available." : "This email is already registered."),
        });
      } catch {
        if (!controller.signal.aborted) {
          setEmailStatus({ checking: false, available: null, reason: "" });
        }
      }
    }, 360);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [email]);

  const pwChecks = {
    length: password.length >= 8 && password.length <= 64,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: /[@$!%*?&_#^]/.test(password),
    allowed: password.length === 0 || /^[A-Za-z\d@$!%*?&_#^]+$/.test(password),
  };

  const pwScore =
    (pwChecks.length ? 1 : 0) +
    (pwChecks.upper ? 1 : 0) +
    (pwChecks.lower ? 1 : 0) +
    (pwChecks.digit ? 1 : 0) +
    (pwChecks.special ? 1 : 0);

  const pwStrengthLabel =
    pwScore === 0
      ? "—"
      : pwScore <= 2
        ? "Weak"
        : pwScore === 3
          ? "Fair"
          : pwScore === 4
            ? "Strong"
            : "Very Strong";

  const handleFileChange = (file: File | undefined) => {
    onError(null);
    if (!file) {
      setValidIdName("");
      setValidIdSizeLabel("");
      return;
    }
    if (!ACCEPTED_ID_TYPES.has(file.type)) {
      onError("Invalid ID file format. Accepted: JPG, PNG, WEBP, or PDF.");
      return;
    }
    if (file.size > MAX_ID_BYTES) {
      onError("Valid ID file must be 5 MB or smaller.");
      return;
    }
    const kb = Math.round(file.size / 1024);
    setValidIdName(file.name);
    setValidIdSizeLabel(kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
  };

  const handleNextFromStep1 = () => {
    onError(null);
    if (firstname.trim().length < 2) {
      onError("First name must be at least 2 characters.");
      return;
    }
    if (lastname.trim().length < 2) {
      onError("Last name must be at least 2 characters.");
      return;
    }
    const numAge = Number(age);
    if (!age || Number.isNaN(numAge) || numAge < 7 || numAge > 120) {
      onError("Please enter a valid age between 7 and 120.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      onError("Please enter a valid contact phone number (at least 7 digits).");
      return;
    }
    if (!gender) {
      onError("Please select your gender.");
      return;
    }
    setStep(2);
  };

  const handleNextFromStep2 = () => {
    onError(null);
    if (isGovernment && officePhone.trim() && officePhone.replace(/\D/g, "").length < 7) {
      onError("Please enter a valid office phone number or leave it blank.");
      return;
    }
    setStep(3);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    onError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmedEmail)) {
      onError("Please enter a valid email address.");
      return;
    }
    if (emailStatus.available === false) {
      onError("This email is already registered. Please sign in or use another email.");
      return;
    }
    if (!pwChecks.allowed) {
      onError("Password contains unsupported characters. Allowed symbols: @$!%*?&_#^");
      return;
    }
    if (pwScore < 5) {
      onError(
        "Password must be 8-64 characters and include uppercase, lowercase, a number, and a special character (@$!%*?&_#^)."
      );
      return;
    }
    if (password !== confirmPassword) {
      onError("Password and Confirm Password do not match.");
      return;
    }
    if (!acceptedTerms) {
      onError("Please accept the Terms & Conditions and Privacy Policy to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          age: age.trim(),
          gender,
          phone: phone.trim(),
          school: school.trim(),
          city: city.trim(),
          province: province.trim(),
          education_level: educationLevel,
          occupation: occupation.trim(),
          is_government: isGovernment,
          office_phone: isGovernment ? officePhone.trim() : "",
          valid_id_name: validIdName,
          email: trimmedEmail,
          password,
          confirm_password: confirmPassword,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (!res.ok || !data.ok) {
        onError(data.error || "Registration failed. Please check your details.");
        return;
      }

      onSuccess(
        data.message ||
          "Registration submitted! Your account is now awaiting administrator approval."
      );
    } catch {
      onError("Network error while submitting registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "h-9.5 w-full rounded-xl border border-white/12 bg-bg1/80 px-3 text-xs text-white placeholder:text-tl/40 focus:border-accent/55 focus:outline-none transition";

  return (
    <div>
      {/* Compact Horizontal 3-Step Pill Track (Interactive for completed steps) */}
      <div className="mb-3.5 grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-bg1/60 p-1">
        {[
          { num: 1 as const, label: "1. Patron Info" },
          { num: 2 as const, label: "2. Verification" },
          { num: 3 as const, label: "3. Credentials" },
        ].map((item) => {
          const isDone = step > item.num;
          const isActive = step === item.num;
          return (
            <button
              key={item.num}
              type="button"
              disabled={!isDone}
              onClick={() => {
                if (isDone) setStep(item.num);
              }}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-[0.72rem] font-bold transition ${
                isActive
                  ? "bg-accent/20 text-accent border border-accent/40 shadow-xs"
                  : isDone
                    ? "bg-accent2/15 text-accent2 hover:bg-accent2/22 cursor-pointer"
                    : "text-white/38 cursor-default"
              }`}
            >
              {isDone && <Check className="h-3 w-3 shrink-0 stroke-[3]" />}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
            className="space-y-2.5"
          >
            {/* Row 1: First Name + Last Name */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[0.68rem] font-semibold text-tl">
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstname}
                  onChange={(e) => setFirstname(e.target.value)}
                  placeholder="Juan"
                  maxLength={50}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.68rem] font-semibold text-tl">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastname}
                  onChange={(e) => setLastname(e.target.value)}
                  placeholder="Dela Cruz"
                  maxLength={50}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row 2: Age + Gender + Contact Number (3 columns in one compact line) */}
            <div className="grid grid-cols-12 gap-2.5">
              <div className="col-span-3">
                <label className="mb-1 block text-[0.68rem] font-semibold text-tl">
                  Age *
                </label>
                <input
                  type="number"
                  min={7}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="7–120"
                  className={inputCls}
                />
              </div>
              <div className="col-span-4">
                <label className="mb-1 block text-[0.68rem] font-semibold text-tl">
                  Gender *
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as "" | "Male" | "Female" | "Others")}
                  className={inputCls}
                >
                  <option value="" className="bg-modal text-white/60">
                    Select
                  </option>
                  {(["Male", "Female", "Others"] as const).map((g) => (
                    <option key={g} value={g} className="bg-modal text-white">
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-5">
                <label className="mb-1 block text-[0.68rem] font-semibold text-tl">
                  Mobile / Phone *
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-accent/65" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09XXXXXXXXX"
                    maxLength={20}
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>
            </div>

            {/* Row 3: City / Municipality + Province */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[0.68rem] font-semibold text-tl">
                  City / Municipality
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Iloilo City"
                  maxLength={60}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.68rem] font-semibold text-tl">
                  Province
                </label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="Iloilo"
                  maxLength={60}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row 4: Education + Occupation + School (3 columns) */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="mb-1 block text-[0.68rem] font-semibold text-tl">
                  Education
                </label>
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className={inputCls}
                >
                  <option value="" className="bg-modal text-white/60">
                    Optional
                  </option>
                  {EDUCATION_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl} className="bg-modal text-white">
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[0.68rem] font-semibold text-tl">
                  Occupation
                </label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder="Student, etc."
                  maxLength={80}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.68rem] font-semibold text-tl">
                  School / Agency
                </label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Optional"
                  maxLength={100}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1.5">
              <span className="font-mono text-[0.68rem] text-white/40">Step 1 of 3</span>
              <Button type="button" variant="accent" size="sm" onClick={handleNextFromStep1}>
                Continue to Verification <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            {/* Valid ID Upload Box */}
            <div>
              <label className="mb-1 flex items-center justify-between text-[0.68rem] font-semibold text-tl">
                <span className="flex items-center gap-1.5">
                  <IdCard className="h-3.5 w-3.5 text-accent" />
                  Valid Government / School ID
                </span>
                <span className="font-normal text-white/40">JPG, PNG, WEBP, PDF · max 5 MB</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-accent/35 bg-white/[0.04] px-3.5 py-2.5 text-left transition hover:border-accent/65 hover:bg-white/[0.07] cursor-pointer"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <FileUp className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-white">
                    {validIdName || "Attach Valid ID for Patron Verification"}
                  </div>
                  <div className="text-[0.68rem] text-tl/65">
                    {validIdSizeLabel
                      ? `Selected (${validIdSizeLabel}) — Click to replace`
                      : "National ID, Student ID, Passport, or Driver's License"}
                  </div>
                </div>
              </button>
            </div>

            {/* Government Employee Toggle + Optional Office Phone inline */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <button
                type="button"
                onClick={() => setIsGovernment((v) => !v)}
                className="flex w-full items-center justify-between text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4 text-accent" />
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Government Official / LGU Employee
                    </div>
                    <div className="text-[0.66rem] text-tl/60">
                      Check if affiliated with Iloilo City Hall or a national government agency
                    </div>
                  </div>
                </div>
                <div
                  className={`flex h-4.5 w-4.5 items-center justify-center rounded border ${
                    isGovernment
                      ? "border-accent bg-accent text-on-accent"
                      : "border-white/25 bg-white/5"
                  }`}
                >
                  {isGovernment && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
              </button>

              {isGovernment && (
                <div className="mt-2.5 border-t border-white/8 pt-2.5">
                  <label className="mb-1 block text-[0.68rem] font-semibold text-tl">
                    Agency / Office Telephone (optional)
                  </label>
                  <input
                    type="tel"
                    value={officePhone}
                    onChange={(e) => setOfficePhone(e.target.value)}
                    placeholder="(033) XXX-XXXX or local extension"
                    maxLength={20}
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn/10 px-3 py-2 text-[0.7rem] leading-relaxed text-warn">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Library staff will verify that your submitted name matches your attached ID before
                activating your digital borrower card.
              </span>
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button
                type="button"
                variant="accent"
                size="sm"
                onClick={handleNextFromStep2}
                className="flex-1"
              >
                Continue to Credentials <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.form
            key="step-3"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
            className="space-y-2.5"
          >
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[0.68rem] font-semibold text-tl">Email Address *</label>
                {emailStatus.reason && (
                  <span
                    className={`inline-flex items-center gap-1 text-[0.66rem] font-medium ${
                      emailStatus.checking
                        ? "text-tl/65"
                        : emailStatus.available
                          ? "text-accent2"
                          : "text-danger"
                    }`}
                  >
                    {emailStatus.checking ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : emailStatus.available ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    <span>{emailStatus.reason}</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-accent/65" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>

            {/* Side-by-side Password & Confirm Password to eliminate vertical overflow */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between text-[0.68rem]">
                  <label className="font-semibold text-tl">Password *</label>
                  <span className="font-mono text-[0.64rem] text-accent">{pwStrengthLabel}</span>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-accent/65" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8+ chars"
                    className={`${inputCls} pl-8.5 pr-8`}
                  />
                  <LibraryTooltip label={showPassword ? "Hide password" : "Show password"}>
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/45 hover:text-white cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </LibraryTooltip>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-[0.68rem]">
                  <label className="font-semibold text-tl">Confirm Password *</label>
                  {confirmPassword && (
                    <span
                      className={`text-[0.64rem] font-semibold ${
                        password === confirmPassword ? "text-accent2" : "text-danger"
                      }`}
                    >
                      {password === confirmPassword ? "✓ Match" : "Mismatch"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-accent/65" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter"
                    className={`${inputCls} pl-8.5 pr-8`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/45 hover:text-white cursor-pointer"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Compact Strength Bar + Rules */}
            <div>
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((seg) => (
                  <div
                    key={seg}
                    className={`h-1 rounded-full transition-colors ${
                      pwScore >= seg
                        ? pwScore <= 2
                          ? "bg-danger"
                          : pwScore <= 4
                            ? "bg-warn"
                            : "bg-accent2"
                        : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1 text-[0.62rem]">
                {[
                  { ok: pwChecks.length, label: "8+ chars" },
                  { ok: pwChecks.upper, label: "A-Z" },
                  { ok: pwChecks.lower, label: "a-z" },
                  { ok: pwChecks.digit, label: "0-9" },
                  { ok: pwChecks.special, label: "Symbol (@$!%*?&_#^)" },
                ].map((rule) => (
                  <span
                    key={rule.label}
                    className={`rounded border px-1.5 py-0.5 font-mono ${
                      rule.ok
                        ? "border-accent2/35 bg-accent2/12 text-accent2"
                        : "border-white/10 bg-white/5 text-white/45"
                    }`}
                  >
                    {rule.ok ? "✓ " : ""}
                    {rule.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <button
                type="button"
                onClick={() => setAcceptedTerms((v) => !v)}
                aria-label="Accept Terms & Conditions"
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border cursor-pointer ${
                  acceptedTerms
                    ? "border-accent bg-accent text-on-accent"
                    : "border-white/30 bg-white/5"
                }`}
              >
                {acceptedTerms && <Check className="h-3 w-3 stroke-[3]" />}
              </button>
              <span className="text-[0.7rem] leading-snug text-tl/80">
                I agree to the Iloilo City Public Library{" "}
                <button
                  type="button"
                  onClick={() => onOpenLegal("terms")}
                  className="font-semibold text-accent underline-offset-2 hover:underline cursor-pointer"
                >
                  Terms of Use
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={() => onOpenLegal("privacy")}
                  className="font-semibold text-accent underline-offset-2 hover:underline cursor-pointer"
                >
                  Privacy Policy
                </button>
                .
              </span>
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep(2)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button
                type="submit"
                variant="accent"
                size="md"
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {submitting ? "Submitting..." : "Submit Membership Application"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
