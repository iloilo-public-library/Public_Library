export type AccountResource = "admins" | "librarians" | "users";

export interface ManagedAccountRow {
  id: number;
  username?: string;
  email: string;
  firstname: string;
  lastname: string;
  fullname: string;
  age?: string;
  gender?: string;
  phone_number?: string;
  school?: string;
  city?: string;
  province?: string;
  education_level?: string;
  occupation?: string;
  is_government?: boolean;
  office_phone?: string;
  valid_id_path?: string;
  role: "admin" | "librarian" | "user" | string;
  status: string;
  is_active: boolean;
  is_approved: boolean;
  is_locked: boolean;
  failed_attempts: number;
  lock_until: string | null;
  last_seen: string | null;
  created_at: string | null;
  otp_enabled?: boolean;
  pin_enabled?: boolean;
}

export interface AccountManagementConfig {
  resource: AccountResource;
  topbarTitle: string;
  headingPrefix: string;
  headingAccent: string;
  subtitle: string;
  singularLabel: string;
  pluralLabel: string;
  totalStatLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  showUsernameColumn: boolean;
  showLastSeenColumn: boolean;
  showAccountStatusColumn: boolean;
  showDeactivatedStat: boolean;
  showFilterTabs: boolean;
  enablePagination: boolean;
  enableViewDetails: boolean;
  enableDeactivateToggle: boolean;
  enableAddModal: boolean;
  addRole?: "admin" | "librarian";
  deletePromptPrefix: string;
  deleteSubtext: string;
  deleteSuccessToast: string;
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toISOString().slice(0, 10);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never";
  const datePart = d.toISOString().slice(0, 10);
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} ${timePart}`;
}

export function formatTimeOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function getInitials(firstname: string, lastname: string): string {
  const f = (firstname || "").trim()[0] || "?";
  const l = (lastname || "").trim()[0] || "?";
  return `${f}${l}`.toUpperCase();
}

export function getPasswordStrength(val: string): {
  label: string;
  color: string;
} {
  if (!val) return { label: "—", color: "var(--acct-text-muted)" };
  if (val.length < 8) return { label: "Too Short", color: "var(--danger)" };
  let score = 0;
  if (val.length >= 8) score++;
  if (val.length >= 12) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[a-z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[@$!%*?&_#^]/.test(val)) score++;
  if (score <= 3) return { label: "Weak", color: "var(--danger)" };
  if (score === 4) return { label: "Fair", color: "var(--warn)" };
  if (score === 5) return { label: "Good", color: "var(--gold)" };
  return { label: "Strong", color: "var(--accent2)" };
}
