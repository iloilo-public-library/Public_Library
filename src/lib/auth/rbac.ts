import { getServerSession, type SessionPayload } from "@/lib/auth/session";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { STAFF_ROLES, type UserRole } from "@/config/constants";

export type { UserRole };

export function isStaffRole(role: string | undefined | null): boolean {
  return role === "admin" || role === "librarian";
}

export function isAdminRole(role: string | undefined | null): boolean {
  return role === "admin";
}

export function hasRole(
  session: SessionPayload | null,
  allowedRoles: readonly UserRole[]
): boolean {
  if (!session) return false;
  return allowedRoles.includes(session.role);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getServerSession();
  if (!session) {
    throw new UnauthorizedError("Unauthorized — please log in.");
  }
  return session;
}

export async function requireRole(
  allowedRoles: readonly UserRole[],
  forbiddenMessage = "Forbidden — insufficient permissions."
): Promise<SessionPayload> {
  const session = await requireSession();
  if (!allowedRoles.includes(session.role)) {
    throw new ForbiddenError(forbiddenMessage);
  }
  return session;
}

export async function requireStaff(): Promise<SessionPayload> {
  return requireRole(STAFF_ROLES, "Unauthorized — staff access required.");
}

export async function requireAdmin(): Promise<SessionPayload> {
  return requireRole(["admin"], "Only Administrators can perform this action.");
}
