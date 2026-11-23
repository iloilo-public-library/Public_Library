"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  IdCard,
  Image as ImageIcon,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Sliders,
  Trash2,
  Unlock,
  User,
  UserPlus,
  X,
} from "lucide-react";
import {
  formatDateOnly,
  formatDateTime,
  getInitials,
  getPasswordStrength,
  type ManagedAccountRow,
} from "./types";

function useFocusTrap(
  open: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
  blocked: boolean
) {
  const stateRef = useRef({ onClose, blocked });
  stateRef.current = { onClose, blocked };

  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    const focusables = el?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusables?.[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!stateRef.current.blocked) stateRef.current.onClose();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const list = el.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, containerRef]);
}

/* ── ADD ADMIN / LIBRARIAN MODAL ── */
interface AddAccountModalProps {
  open: boolean;
  role: "admin" | "librarian";
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
  }) => Promise<boolean>;
}

export function AddAccountModal({
  open,
  role,
  submitting,
  error,
  onClose,
  onSubmit,
}: AddAccountModalProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  useFocusTrap(open, ref, onClose, submitting);

  useEffect(() => {
    if (!open) {
      setFirstname("");
      setLastname("");
      setEmail("");
      setPassword("");
      setShowPw(false);
    }
  }, [open]);

  if (!open) return null;

  const isAdmin = role === "admin";
  const strength = getPasswordStrength(password);

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await onSubmit({ firstname, lastname, email, password });
    if (ok) onClose();
  };

  const inputStyle = {
    backgroundColor: "var(--acct-input-bg)",
    border: "1px solid var(--acct-input-border)",
    color: "var(--acct-text-primary)",
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[4px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-acct-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={ref}
        className="w-full max-w-[460px] max-h-[92dvh] overflow-y-auto rounded-[20px] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.55)]"
        style={{
          background: "var(--acct-modal-bg)",
          border: "1px solid var(--acct-modal-border)",
          color: "var(--acct-text-primary)",
        }}
      >
        <div
          className="mb-4 flex items-center justify-between pb-3.5"
          style={{ borderBottom: "1px solid var(--acct-border)" }}
        >
          <h2
            id="add-acct-modal-title"
            className="flex items-center gap-2 text-[1.05rem] font-bold"
            style={{ color: isAdmin ? "var(--warn)" : "var(--accent)" }}
          >
            {isAdmin ? (
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            ) : (
              <IdCard className="h-5 w-5" aria-hidden="true" />
            )}
            <span>{isAdmin ? "Add Admin" : "Add Librarian"}</span>
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-11 w-11 items-center justify-center rounded-lg cursor-pointer"
            style={{ color: "var(--acct-text-muted)" }}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div
          className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.05em]"
          style={
            isAdmin
              ? {
                  backgroundColor: "rgba(var(--warn-rgb), 0.12)",
                  border: "1px solid rgba(var(--warn-rgb), 0.32)",
                  color: "var(--warn)",
                }
              : {
                  backgroundColor: "rgba(var(--accent-rgb), 0.12)",
                  border: "1px solid rgba(var(--accent-rgb), 0.28)",
                  color: "var(--accent)",
                }
          }
        >
          {isAdmin ? "Role: Administrator" : "Role: Librarian"}
        </div>

        <form onSubmit={(e) => void handleFormSubmit(e)} className="space-y-3.5">
          {error && (
            <div
              role="alert"
              className="rounded-xl px-3.5 py-2.5 text-xs"
              style={{
                backgroundColor: "rgba(var(--danger-rgb), 0.12)",
                border: "1px solid rgba(var(--danger-rgb), 0.35)",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="add-acct-fn"
              className="mb-1 block text-[0.78rem] font-semibold"
              style={{ color: "var(--acct-text-secondary)" }}
            >
              First Name
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--acct-text-faint)" }}
                aria-hidden="true"
              />
              <input
                id="add-acct-fn"
                type="text"
                required
                minLength={2}
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                placeholder="First Name"
                className="min-h-[44px] w-full rounded-[9px] py-2 pl-9 pr-3 text-[0.88rem]"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="add-acct-ln"
              className="mb-1 block text-[0.78rem] font-semibold"
              style={{ color: "var(--acct-text-secondary)" }}
            >
              Last Name
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--acct-text-faint)" }}
                aria-hidden="true"
              />
              <input
                id="add-acct-ln"
                type="text"
                required
                minLength={2}
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                placeholder="Last Name"
                className="min-h-[44px] w-full rounded-[9px] py-2 pl-9 pr-3 text-[0.88rem]"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="add-acct-email"
              className="mb-1 block text-[0.78rem] font-semibold"
              style={{ color: "var(--acct-text-secondary)" }}
            >
              Email Address
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--acct-text-faint)" }}
                aria-hidden="true"
              />
              <input
                id="add-acct-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="min-h-[44px] w-full rounded-[9px] py-2 pl-9 pr-3 text-[0.88rem]"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="add-acct-pw"
              className="mb-1 block text-[0.78rem] font-semibold"
              style={{ color: "var(--acct-text-secondary)" }}
            >
              Password
            </label>
            <p className="mb-1.5 text-[0.74rem]" style={{ color: "var(--acct-text-muted)" }}>
              8–64 characters with uppercase, lowercase, number &amp; special character
              (@$!%*?&amp;_#^).
            </p>
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <input
                  id="add-acct-pw"
                  type={showPw ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={64}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="min-h-[44px] w-full rounded-[9px] py-2 pl-3 pr-11 text-[0.88rem]"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md cursor-pointer"
                  style={{ color: "var(--acct-text-muted)" }}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div
                className="min-w-[84px] text-right text-[0.74rem]"
                style={{ color: "var(--acct-text-muted)" }}
              >
                Strength:{" "}
                <span className="font-bold" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[11px] px-4 py-2.5 text-[0.9rem] font-bold transition cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: isAdmin ? "var(--warn)" : "var(--accent)",
              color: "#0d1a24",
            }}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {isAdmin ? "Create Admin Account" : "Create Librarian Account"}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── RESET PASSWORD MODAL ── */
interface ResetPasswordModalProps {
  open: boolean;
  account: ManagedAccountRow | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (userId: number, newPassword: string) => Promise<boolean>;
}

export function ResetPasswordModal({
  open,
  account,
  submitting,
  error,
  onClose,
  onSubmit,
}: ResetPasswordModalProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useFocusTrap(open, ref, onClose, submitting);

  useEffect(() => {
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
      setLocalError(null);
    }
  }, [open]);

  if (!open || !account) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }
    setLocalError(null);
    const ok = await onSubmit(account.id, newPassword);
    if (ok) onClose();
  };

  const inputStyle = {
    backgroundColor: "var(--acct-input-bg)",
    border: "1px solid var(--acct-input-border)",
    color: "var(--acct-text-primary)",
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[4px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-pw-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={ref}
        className="w-full max-w-[460px] rounded-[20px] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.55)]"
        style={{
          background: "var(--acct-modal-bg)",
          border: "1px solid var(--acct-modal-border)",
          color: "var(--acct-text-primary)",
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2
            id="reset-pw-modal-title"
            className="flex items-center gap-2 text-[1.1rem] font-bold"
          >
            <KeyRound
              className="h-5 w-5"
              style={{ color: "var(--warn)" }}
              aria-hidden="true"
            />
            <span>Reset Password</span>
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-11 w-11 items-center justify-center rounded-lg cursor-pointer"
            style={{ color: "var(--acct-text-muted)" }}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
          <div>
            <label
              htmlFor="reset-acct-username"
              className="mb-1 block text-[0.78rem] font-semibold"
              style={{ color: "var(--acct-text-secondary)" }}
            >
              Username
            </label>
            <input
              id="reset-acct-username"
              type="text"
              readOnly
              value={account.email || account.fullname}
              className="min-h-[44px] w-full cursor-not-allowed rounded-[9px] px-3 py-2 text-[0.88rem] opacity-65"
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="reset-acct-newpw"
              className="mb-1 block text-[0.78rem] font-semibold"
              style={{ color: "var(--acct-text-secondary)" }}
            >
              New Password
            </label>
            <input
              id="reset-acct-newpw"
              type="password"
              required
              minLength={8}
              maxLength={64}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="min-h-[44px] w-full rounded-[9px] px-3 py-2 text-[0.88rem]"
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="reset-acct-confirmpw"
              className="mb-1 block text-[0.78rem] font-semibold"
              style={{ color: "var(--acct-text-secondary)" }}
            >
              Confirm Password
            </label>
            <input
              id="reset-acct-confirmpw"
              type="password"
              required
              minLength={8}
              maxLength={64}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="min-h-[44px] w-full rounded-[9px] px-3 py-2 text-[0.88rem]"
              style={inputStyle}
            />
          </div>

          {(localError || error) && (
            <p role="alert" className="text-[0.78rem]" style={{ color: "var(--danger)" }}>
              {localError || error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[11px] px-4 py-2.5 text-[0.9rem] font-bold transition cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--on-accent)",
            }}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Reset Password</span>
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── CONFIRM MODAL (Delete / Deactivate / Reactivate) ── */
interface ConfirmActionModalProps {
  open: boolean;
  variant: "delete" | "deactivate" | "reactivate";
  title: string;
  leadText: string;
  personName: string;
  subtext: string;
  confirmLabel: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmActionModal({
  open,
  variant,
  title,
  leadText,
  personName,
  subtext,
  confirmLabel,
  submitting,
  onCancel,
  onConfirm,
}: ConfirmActionModalProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useFocusTrap(open, ref, onCancel, submitting);

  if (!open) return null;

  const toneColor =
    variant === "delete"
      ? "var(--danger)"
      : variant === "deactivate"
      ? "var(--warn)"
      : "var(--accent2)";

  const confirmTextColor = variant === "delete" ? "#ffffff" : "#0d1a24";

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[4px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
    >
      <div
        ref={ref}
        className="w-full max-w-[420px] rounded-[20px] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.55)]"
        style={{
          background: "var(--acct-modal-bg)",
          border: "1px solid var(--acct-modal-border)",
          color: "var(--acct-text-primary)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="confirm-action-modal-title"
            className="flex items-center gap-2 text-[1.08rem] font-bold"
            style={{ color: toneColor }}
          >
            {variant === "delete" ? (
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            ) : variant === "deactivate" ? (
              <PauseCircle className="h-5 w-5" aria-hidden="true" />
            ) : (
              <PlayCircle className="h-5 w-5" aria-hidden="true" />
            )}
            <span>{title}</span>
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            aria-label="Close modal"
            className="flex h-11 w-11 items-center justify-center rounded-lg cursor-pointer"
            style={{ color: "var(--acct-text-muted)" }}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p
          className="mb-5 text-[0.9rem] leading-relaxed"
          style={{ color: "var(--acct-text-secondary)" }}
        >
          {leadText}{" "}
          <strong style={{ color: "var(--acct-text-primary)" }}>
            &ldquo;{personName}&rdquo;
          </strong>
          ?
          <span
            className="mt-1.5 block text-[0.8rem]"
            style={{ color: "var(--acct-text-muted)" }}
          >
            {subtext}
          </span>
        </p>

        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-[11px] px-4 py-2.5 text-[0.88rem] font-semibold transition cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: "var(--acct-pill-bg)",
              border: "1px solid var(--acct-pill-border)",
              color: "var(--acct-text-primary)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onConfirm()}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[11px] px-4 py-2.5 text-[0.88rem] font-bold transition cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: toneColor,
              color: confirmTextColor,
            }}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : variant === "delete" ? (
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            ) : variant === "deactivate" ? (
              <PauseCircle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── VIEW DETAILS MODAL (5 tabs, Users / Members page) ── */
type DetailTab = "id" | "profile" | "security" | "activity" | "validid";

interface UserDetailsModalProps {
  open: boolean;
  user: ManagedAccountRow | null;
  onClose: () => void;
}

export function UserDetailsModal({ open, user, onClose }: UserDetailsModalProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<DetailTab>("id");
  const [imgError, setImgError] = useState(false);

  useFocusTrap(open, ref, onClose, false);

  useEffect(() => {
    if (open) {
      setTab("id");
      setImgError(false);
    }
  }, [open, user?.id]);

  if (!open || !user) return null;

  const isOnline = user.status === "active";
  const attempts = user.failed_attempts || 0;
  const hasValidId = Boolean(user.valid_id_path && user.valid_id_path.trim());
  const validIdUrl = hasValidId ? `/api/admin/valid-id/${user.id}` : null;
  const isPdf = Boolean(
    user.valid_id_path && user.valid_id_path.toLowerCase().endsWith(".pdf")
  );

  const tabs: { id: DetailTab; label: string; icon: typeof IdCard }[] = [
    { id: "id", label: "ID Card", icon: IdCard },
    { id: "profile", label: "Profile", icon: Info },
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "activity", label: "Activity", icon: Clock },
    { id: "validid", label: "Valid ID", icon: ImageIcon },
  ];

  const orDash = (v: string | undefined | null) =>
    v && v.trim() ? v : "—";

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[4px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vd-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="flex max-h-[92dvh] w-full max-w-[660px] flex-col overflow-hidden rounded-[22px] shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
        style={{
          background: "var(--acct-modal-bg)",
          border: "1px solid var(--acct-modal-border)",
          color: "var(--acct-text-primary)",
        }}
      >
        {/* Header */}
        <div className="relative flex items-start gap-4 px-7 pt-6">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] text-[1.35rem] font-bold"
            style={{
              background:
                "linear-gradient(135deg, rgba(var(--accent-rgb), 0.25), rgba(var(--accent-rgb), 0.08))",
              border: "1px solid rgba(var(--accent-rgb), 0.25)",
              color: "var(--accent)",
            }}
            aria-hidden="true"
          >
            {getInitials(user.firstname, user.lastname)}
          </div>
          <div className="min-w-0 flex-1 pr-10">
            <h2 id="vd-modal-title" className="truncate text-[1.1rem] font-bold">
              {user.fullname || "(No name)"}
            </h2>
            <div
              className="mt-0.5 truncate font-mono text-[0.78rem]"
              style={{ color: "var(--acct-text-secondary)" }}
            >
              {user.email || "—"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold capitalize"
                style={{
                  backgroundColor: "rgba(var(--accent-rgb), 0.12)",
                  border: "1px solid rgba(var(--accent-rgb), 0.25)",
                  color: "var(--accent)",
                }}
              >
                {user.role || "user"}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold"
                style={
                  isOnline
                    ? {
                        backgroundColor: "rgba(var(--accent2-rgb), 0.14)",
                        border: "1px solid rgba(var(--accent2-rgb), 0.3)",
                        color: "var(--accent2)",
                      }
                    : {
                        backgroundColor: "var(--acct-pill-bg)",
                        border: "1px solid var(--acct-pill-border)",
                        color: "var(--acct-text-muted)",
                      }
                }
              >
                {isOnline ? "Online" : "Offline"}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold"
                style={
                  user.is_active
                    ? {
                        backgroundColor: "rgba(var(--accent2-rgb), 0.12)",
                        border: "1px solid rgba(var(--accent2-rgb), 0.24)",
                        color: "var(--accent2)",
                      }
                    : {
                        backgroundColor: "rgba(var(--danger-rgb), 0.12)",
                        border: "1px solid rgba(var(--danger-rgb), 0.24)",
                        color: "var(--danger)",
                      }
                }
              >
                {user.is_active ? "Enabled" : "Deactivated"}
              </span>
              {user.is_locked && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold"
                  style={{
                    backgroundColor: "rgba(var(--danger-rgb), 0.14)",
                    border: "1px solid rgba(var(--danger-rgb), 0.3)",
                    color: "var(--danger)",
                  }}
                >
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Locked
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details modal"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-lg cursor-pointer"
            style={{ color: "var(--acct-text-muted)" }}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="User details sections"
          className="mt-4 flex flex-wrap gap-1 px-7"
          style={{ borderBottom: "1px solid var(--acct-border)" }}
        >
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className="relative flex min-h-[44px] items-center gap-1.5 rounded-t-[9px] px-3.5 py-2 text-[0.8rem] font-semibold transition cursor-pointer"
                style={{
                  color: active ? "var(--accent)" : "var(--acct-text-muted)",
                  backgroundColor: active
                    ? "rgba(var(--accent-rgb), 0.08)"
                    : "transparent",
                }}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{label}</span>
                {active && (
                  <span
                    className="absolute bottom-[-1px] left-0 right-0 h-[2px]"
                    style={{ backgroundColor: "var(--accent)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          {tab === "id" && (
            <div className="space-y-4">
              <div
                className="rounded-[14px] p-5"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(var(--accent-rgb), 0.12) 0%, rgba(var(--accent2-rgb), 0.06) 100%)",
                  border: "1px solid rgba(var(--accent-rgb), 0.22)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div
                      className="text-[0.68rem] font-bold uppercase tracking-[0.08em]"
                      style={{ color: "var(--acct-text-faint)" }}
                    >
                      User ID
                    </div>
                    <div
                      className="acct-tabular font-mono text-[1.6rem] font-bold leading-tight"
                      style={{ color: "var(--accent)" }}
                    >
                      #{String(user.id).padStart(4, "0")}
                    </div>
                    <div
                      className="mt-1 text-[0.75rem]"
                      style={{ color: "var(--acct-text-secondary)" }}
                    >
                      Iloilo Public Library
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-[0.68rem] font-bold uppercase tracking-[0.08em]"
                      style={{ color: "var(--acct-text-faint)" }}
                    >
                      Role
                    </div>
                    <div className="mt-1 text-xs font-bold capitalize" style={{ color: "var(--accent)" }}>
                      {user.role || "user"}
                    </div>
                  </div>
                </div>
                <div
                  className="mt-3.5 flex flex-wrap items-center justify-between gap-3 pt-3"
                  style={{ borderTop: "1px solid var(--acct-border)" }}
                >
                  <div>
                    <div
                      className="text-[0.68rem] font-bold uppercase tracking-[0.08em]"
                      style={{ color: "var(--acct-text-faint)" }}
                    >
                      Full Name
                    </div>
                    <div className="mt-0.5 text-[0.92rem] font-semibold">
                      {user.fullname || "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-[0.68rem] font-bold uppercase tracking-[0.08em]"
                      style={{ color: "var(--acct-text-faint)" }}
                    >
                      Registered
                    </div>
                    <div
                      className="mt-0.5 text-[0.8rem]"
                      style={{ color: "var(--acct-text-secondary)" }}
                    >
                      {formatDateOnly(user.created_at)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div
                  className="rounded-[10px] p-3 sm:col-span-2"
                  style={{
                    backgroundColor: "var(--acct-inner-bg)",
                    border: "1px solid var(--acct-border)",
                  }}
                >
                  <div
                    className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.07em]"
                    style={{ color: "var(--acct-text-faint)" }}
                  >
                    Email / Username
                  </div>
                  <div className="break-all font-mono text-[0.82rem]">
                    {user.email || "—"}
                  </div>
                </div>
                {[
                  { label: "Online Status", value: isOnline ? "Online" : "Offline" },
                  { label: "Account Status", value: user.is_active ? "Enabled" : "Deactivated" },
                  { label: "Lock Status", value: user.is_locked ? "Locked" : "Unlocked" },
                  { label: "Last Seen", value: formatDateTime(user.last_seen) },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[10px] p-3"
                    style={{
                      backgroundColor: "var(--acct-inner-bg)",
                      border: "1px solid var(--acct-border)",
                    }}
                  >
                    <div
                      className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.07em]"
                      style={{ color: "var(--acct-text-faint)" }}
                    >
                      {item.label}
                    </div>
                    <div className="text-[0.84rem] font-medium">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "profile" && (
            <div className="space-y-4">
              <div>
                <div
                  className="mb-2.5 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.1em]"
                  style={{ color: "var(--acct-text-faint)" }}
                >
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  Personal Information
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { label: "First Name", val: orDash(user.firstname) },
                    { label: "Last Name", val: orDash(user.lastname) },
                    { label: "Gender", val: orDash(user.gender) },
                    { label: "Age", val: orDash(user.age) },
                    { label: "Phone Number", val: orDash(user.phone_number), mono: true },
                    { label: "City", val: orDash(user.city) },
                    { label: "Province", val: orDash(user.province) },
                    { label: "User ID", val: `#${user.id}`, mono: true },
                    { label: "Email / Username", val: orDash(user.email), mono: true, full: true },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-[10px] p-3 ${item.full ? "sm:col-span-2" : ""}`}
                      style={{
                        backgroundColor: "var(--acct-inner-bg)",
                        border: "1px solid var(--acct-border)",
                      }}
                    >
                      <div
                        className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.07em]"
                        style={{ color: "var(--acct-text-faint)" }}
                      >
                        {item.label}
                      </div>
                      <div
                        className={`break-all text-[0.85rem] font-medium ${
                          item.mono ? "font-mono text-[0.8rem]" : ""
                        }`}
                      >
                        {item.val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div
                  className="mb-2.5 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.1em]"
                  style={{ color: "var(--acct-text-faint)" }}
                >
                  <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                  Background
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { label: "Occupation", val: orDash(user.occupation) },
                    { label: "Education Level", val: orDash(user.education_level) },
                    { label: "School / Institution", val: orDash(user.school) },
                    { label: "Government Employee", val: user.is_government ? "Yes" : "No" },
                    { label: "Office Phone", val: orDash(user.office_phone), mono: true },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[10px] p-3"
                      style={{
                        backgroundColor: "var(--acct-inner-bg)",
                        border: "1px solid var(--acct-border)",
                      }}
                    >
                      <div
                        className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.07em]"
                        style={{ color: "var(--acct-text-faint)" }}
                      >
                        {item.label}
                      </div>
                      <div className={`text-[0.85rem] font-medium ${item.mono ? "font-mono text-[0.8rem]" : ""}`}>
                        {item.val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div
                  className="mb-2.5 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.1em]"
                  style={{ color: "var(--acct-text-faint)" }}
                >
                  <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                  Account Settings
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div
                    className="rounded-[10px] p-3"
                    style={{
                      backgroundColor: "var(--acct-inner-bg)",
                      border: "1px solid var(--acct-border)",
                    }}
                  >
                    <div
                      className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.07em]"
                      style={{ color: "var(--acct-text-faint)" }}
                    >
                      Account Approved
                    </div>
                    <div
                      className="text-[0.84rem] font-semibold"
                      style={{ color: user.is_approved ? "var(--accent2)" : "var(--warn)" }}
                    >
                      {user.is_approved ? "Approved" : "Pending"}
                    </div>
                  </div>
                  <div
                    className="rounded-[10px] p-3"
                    style={{
                      backgroundColor: "var(--acct-inner-bg)",
                      border: "1px solid var(--acct-border)",
                    }}
                  >
                    <div
                      className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.07em]"
                      style={{ color: "var(--acct-text-faint)" }}
                    >
                      OTP / 2FA
                    </div>
                    <div className="text-[0.8rem]" style={{ color: "var(--acct-text-muted)" }}>
                      {typeof user.otp_enabled === "boolean"
                        ? user.otp_enabled
                          ? "Enabled"
                          : "Disabled"
                        : "Not available yet"}
                    </div>
                  </div>
                  <div
                    className="rounded-[10px] p-3"
                    style={{
                      backgroundColor: "var(--acct-inner-bg)",
                      border: "1px solid var(--acct-border)",
                    }}
                  >
                    <div
                      className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.07em]"
                      style={{ color: "var(--acct-text-faint)" }}
                    >
                      PIN Lock
                    </div>
                    <div className="text-[0.8rem]" style={{ color: "var(--acct-text-muted)" }}>
                      {typeof user.pin_enabled === "boolean"
                        ? user.pin_enabled
                          ? "Enabled"
                          : "Disabled"
                        : "Not available yet"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "security" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div
                className="rounded-[10px] p-3"
                style={{
                  backgroundColor: "var(--acct-inner-bg)",
                  border: "1px solid var(--acct-border)",
                }}
              >
                <div
                  className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.07em]"
                  style={{ color: "var(--acct-text-faint)" }}
                >
                  Account Lock
                </div>
                <div
                  className="inline-flex items-center gap-1.5 text-[0.86rem] font-semibold"
                  style={{ color: user.is_locked ? "var(--danger)" : "var(--accent2)" }}
                >
                  {user.is_locked ? (
                    <>
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Locked
                    </>
                  ) : (
                    <>
                      <Unlock className="h-3.5 w-3.5" aria-hidden="true" /> Unlocked
                    </>
                  )}
                </div>
              </div>

              <div
                className="rounded-[10px] p-3"
                style={{
                  backgroundColor: "var(--acct-inner-bg)",
                  border: "1px solid var(--acct-border)",
                }}
              >
                <div
                  className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.07em]"
                  style={{ color: "var(--acct-text-faint)" }}
                >
                  Lock Expires
                </div>
                <div className="font-mono text-[0.82rem]">
                  {user.lock_until ? formatDateTime(user.lock_until) : "N/A"}
                </div>
              </div>

              <div
                className="rounded-[10px] p-3 sm:col-span-2"
                style={{
                  backgroundColor: "var(--acct-inner-bg)",
                  border: "1px solid var(--acct-border)",
                }}
              >
                <div
                  className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.07em]"
                  style={{ color: "var(--acct-text-faint)" }}
                >
                  Failed Login Attempts
                </div>
                <div
                  className="acct-tabular text-base font-bold"
                  style={{ color: attempts >= 3 ? "var(--danger)" : "var(--accent2)" }}
                >
                  {attempts} / 5
                </div>
                <div className="mt-1.5 flex gap-1" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="h-2.5 w-2.5 rounded-[3px]"
                      style={{
                        backgroundColor:
                          i < attempts
                            ? attempts >= 5
                              ? "var(--danger)"
                              : attempts >= 3
                              ? "var(--warn)"
                              : "var(--accent2)"
                            : "var(--acct-pill-bg)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "activity" && (
            <div className="space-y-1">
              {[
                user.created_at && {
                  label: "Account registered",
                  time: formatDateTime(user.created_at),
                  color: "var(--accent2)",
                },
                user.last_seen && {
                  label: "Last seen / session",
                  time: formatDateTime(user.last_seen),
                  color: "var(--accent)",
                },
                user.is_locked &&
                  user.lock_until && {
                    label: "Account locked — expires",
                    time: formatDateTime(user.lock_until),
                    color: "var(--danger)",
                  },
                !user.is_active && {
                  label: "Account deactivated",
                  time: "—",
                  color: "var(--warn)",
                },
              ]
                .filter((x): x is { label: string; time: string; color: string } =>
                  Boolean(x)
                )
                .map((ev) => (
                  <div
                    key={ev.label}
                    className="flex items-start gap-3 py-2.5"
                    style={{ borderBottom: "1px solid var(--acct-border-subtle)" }}
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: ev.color }}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="text-[0.85rem] font-medium">{ev.label}</div>
                      <div
                        className="mt-0.5 text-[0.73rem]"
                        style={{ color: "var(--acct-text-muted)" }}
                      >
                        {ev.time}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {tab === "validid" && (
            <div
              className="overflow-hidden rounded-[12px] text-center"
              style={{
                backgroundColor: "var(--acct-inner-bg)",
                border: "1px solid var(--acct-border)",
              }}
            >
              {validIdUrl ? (
                isPdf ? (
                  <div className="px-5 py-7">
                    <FileText
                      className="mx-auto mb-2.5 h-10 w-10"
                      style={{ color: "var(--danger)" }}
                      aria-hidden="true"
                    />
                    <p
                      className="mb-3.5 text-[0.86rem]"
                      style={{ color: "var(--acct-text-secondary)" }}
                    >
                      PDF document uploaded as valid ID
                    </p>
                    <a
                      href={validIdUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold"
                      style={{
                        backgroundColor: "rgba(var(--accent-rgb), 0.12)",
                        border: "1px solid rgba(var(--accent-rgb), 0.25)",
                        color: "var(--accent)",
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Open PDF
                    </a>
                  </div>
                ) : (
                  <>
                    {imgError ? (
                      <div
                        className="px-5 py-9 text-[0.84rem]"
                        style={{ color: "var(--acct-text-muted)" }}
                      >
                        Could not load valid ID image.
                      </div>
                    ) : (
                      <img
                        src={validIdUrl}
                        alt={`Government-issued ID for ${user.fullname}`}
                        onError={() => setImgError(true)}
                        className="mx-auto block max-h-[320px] max-w-full object-contain p-2"
                      />
                    )}
                    <div
                      className="flex justify-end px-3.5 py-2.5"
                      style={{ borderTop: "1px solid var(--acct-border)" }}
                    >
                      <a
                        href={validIdUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold"
                        style={{
                          backgroundColor: "rgba(var(--accent-rgb), 0.12)",
                          border: "1px solid rgba(var(--accent-rgb), 0.25)",
                          color: "var(--accent)",
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        Open Full Size
                      </a>
                    </div>
                  </>
                )
              ) : (
                <div
                  className="px-5 py-9 text-[0.84rem]"
                  style={{ color: "var(--acct-text-muted)" }}
                >
                  <ImageIcon
                    className="mx-auto mb-2 h-9 w-9 opacity-40"
                    aria-hidden="true"
                  />
                  No valid ID has been uploaded for this user.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
