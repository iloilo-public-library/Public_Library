export interface AdminProfile {
  id: number;
  email: string;
  firstname: string;
  lastname: string;
  fullname: string;
  gender: string;
  phone_number: string;
  role: string;
  is_active: boolean;
  is_approved: boolean;
  otp_enabled: boolean;
  pin_enabled: boolean;
  created_at: string;
  last_seen: string | null;
}

export interface LoginSession {
  id: number;
  session_token: string;
  login_at: string;
  last_active_at: string;
  logout_at: string | null;
}

export interface AdminProfileResponse {
  profile: AdminProfile;
  loginActivity: LoginSession[];
}

export type SectionId = "overview" | "personal" | "security" | "appearance";
export type PersonalSubTab = "info" | "contact";

export function getInitials(
  firstname: string,
  lastname: string,
  fullname: string,
  email: string
): string {
  const f = firstname.trim();
  const l = lastname.trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  const parts = fullname.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2)
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2)
    return parts[0].slice(0, 2).toUpperCase();
  if (email.trim()) return email.trim().slice(0, 2).toUpperCase();
  return "AD";
}
