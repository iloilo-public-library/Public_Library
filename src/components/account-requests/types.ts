export type RequestType = "register" | "renew" | "deactivate" | "delete";
export type RequestStatus = "pending" | "approved" | "rejected";
export type RequestSection = "register" | "renew" | "danger";
export type StatusFilter = "all" | RequestStatus;

export interface AccountRequestRow {
  id: number;
  user_id: number;
  username: string;
  request_type: RequestType;
  reason: string;
  status: RequestStatus;
  admin_note: string;
  created_at: string;
  reviewed_at: string | null;
  card_id: number | null;
  renewal1_checked: boolean;
  renewal1_date: string | null;
  renewal2_checked: boolean;
  renewal2_date: string | null;
  email: string;
  fullname: string;
  firstname: string;
  lastname: string;
  age: number | null;
  gender: string;
  phone_number: string;
  school: string;
  city: string;
  province: string;
  education_level: string;
  occupation: string;
  is_government: boolean;
  office_phone: string;
  valid_id_path: string;
}

export interface ToastState {
  id: number;
  message: string;
  tone: "success" | "warn" | "err";
}

export function getDisplayName(row: Pick<AccountRequestRow, "fullname" | "firstname" | "lastname" | "username">): string {
  const full = (row.fullname || `${row.firstname || ""} ${row.lastname || ""}`).trim();
  return full || row.username || "Unknown User";
}

export function getInitials(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400 / 7)}w ago`;
  return fmtDate(value);
}

export function getRequestTypeLabel(type: RequestType): string {
  switch (type) {
    case "register":
      return "New Signup";
    case "renew":
      return "Card Renewal";
    case "deactivate":
      return "Deactivation";
    case "delete":
      return "Account Deletion";
  }
}

export function matchesSection(row: AccountRequestRow, section: RequestSection): boolean {
  if (section === "register") return row.request_type === "register";
  if (section === "renew") return row.request_type === "renew";
  return row.request_type === "deactivate" || row.request_type === "delete";
}
