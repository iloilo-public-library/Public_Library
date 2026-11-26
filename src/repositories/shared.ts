import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { safeDecryptEmail, safeDecryptPii } from "@/lib/crypto/fernet";

export class AdminMutationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function assertNotOwnAccount(
  sessionUserId: number,
  targetUserId: number,
  action: "delete" | "deactivate"
) {
  if (sessionUserId === targetUserId) {
    throw new AdminMutationError(
      `You cannot ${action} your own active admin account.`,
      400
    );
  }
}

export function assertLibrarianRenewalOnly(
  sessionRole: string,
  requestType: string
) {
  if (sessionRole !== "admin" && requestType !== "renew") {
    throw new AdminMutationError(
      "Librarians can only manage library card renewal requests.",
      403
    );
  }
}

export const PW_ALLOWED_RE = /^[A-Za-z\d@$!%*?&_#^]{8,64}$/;
export const PW_COMPLEXITY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#^]).{8,64}$/;

export function requireAdminOnly(session: SessionPayload) {
  if (session.role !== "admin") {
    throw new AdminMutationError("Only Administrators can perform this action.", 403);
  }
}

export async function getStaffDisplayName(
  supabase: SupabaseClient,
  userId: number,
  role: string
): Promise<string> {
  const { data } = await supabase
    .from("users")
    .select("firstname, lastname")
    .eq("id", userId)
    .single();
  const fn = data ? safeDecryptPii(data.firstname) : "";
  const ln = data ? safeDecryptPii(data.lastname) : "";
  const full =
    fn.startsWith("gAAAAAB") || ln.startsWith("gAAAAAB")
      ? ""
      : `${fn} ${ln}`.trim();
  const roleLabel = role === "admin" ? "Admin" : "Librarian";
  return (full ? `${full} (${roleLabel})` : `Library ${roleLabel}`).slice(0, 100);
}

export function formatFullName(firstname: unknown, lastname: unknown): string {
  const fn = safeDecryptPii(firstname);
  const ln = safeDecryptPii(lastname);
  if (fn.startsWith("gAAAAAB")) return fn;
  if (ln.startsWith("gAAAAAB")) return ln;
  return `${fn} ${ln}`.trim() || "—";
}

export function resolveEmail(emailDisplay: unknown, username: unknown): string {
  const disp = safeDecryptEmail(emailDisplay);
  if (disp && !disp.startsWith("gAAAAAB")) return disp;
  const userDec = safeDecryptEmail(username);
  if (userDec && !userDec.startsWith("gAAAAAB")) return userDec;
  return disp || String(username ?? "");
}

export function computeOnlineStatus(rawStatus: unknown, lastSeen: unknown): string {
  if (!lastSeen) return String(rawStatus ?? "offline");
  const ts = Date.parse(String(lastSeen));
  if (Number.isNaN(ts)) return String(rawStatus ?? "offline");
  if (Date.now() - ts > 5 * 60 * 1000) return "offline";
  return String(rawStatus ?? "active");
}
