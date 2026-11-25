import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSession, type SessionPayload } from "@/lib/auth/session";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { STAFF_ROLES, type UserRole } from "@/config/constants";
import { createSupabaseServerClient, getSupabaseSecretKey } from "@/lib/supabase/server";

export type { UserRole };

const TOUCH_INTERVAL_MS = 60 * 1000; // Matches legacy-flask/helpers/login_sessions.py TOUCH_EVERY = 60s

interface GlobalWithSessionTouch {
  __icplSessionTouches?: Map<string, number>;
}

const g = globalThis as unknown as GlobalWithSessionTouch;

function getTouchStore(): Map<string, number> {
  if (!g.__icplSessionTouches) {
    g.__icplSessionTouches = new Map<string, number>();
  }
  return g.__icplSessionTouches;
}

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

/**
 * Throttled session heartbeat (once per 60s per sessionToken) matching legacy Flask
 * `touch_session()` + `update_last_seen()`. Keeps `login_sessions.last_active_at` and
 * `users.last_seen` fresh while the admin or librarian is active.
 */
export async function touchSessionActivity(
  session: SessionPayload,
  existingClient?: SupabaseClient | null
): Promise<void> {
  if (!session.sessionToken) return;
  const nowMs = Date.now();
  const touches = getTouchStore();
  const lastTouch = touches.get(session.sessionToken) ?? 0;
  if (nowMs - lastTouch < TOUCH_INTERVAL_MS) return;

  touches.set(session.sessionToken, nowMs);
  if (touches.size > 1000) {
    for (const [k, ts] of touches.entries()) {
      if (nowMs - ts > 3600 * 1000) touches.delete(k);
    }
  }

  try {
    const supabase =
      existingClient ?? (getSupabaseSecretKey() ? createSupabaseServerClient(true) : null);
    if (!supabase) return;

    const nowIso = new Date(nowMs).toISOString();
    await Promise.all([
      supabase
        .from("login_sessions")
        .update({ last_active_at: nowIso })
        .eq("session_token", session.sessionToken)
        .is("logout_at", null),
      supabase
        .from("users")
        .update({ last_seen: nowIso, status: "active" })
        .eq("id", session.userId),
    ]);
  } catch {
    // Non-blocking heartbeat update
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getServerSession();
  if (!session) {
    throw new UnauthorizedError("Unauthorized — please log in.");
  }
  void touchSessionActivity(session);
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
  return requireRole(STAFF_ROLES, "Forbidden — staff access required.");
}

export async function requireAdmin(): Promise<SessionPayload> {
  return requireRole(["admin"], "Only Administrators can perform this action.");
}

/**
 * Repository-level RBAC and active-account verification for sensitive data access.
 * Ensures that even if a route handler is misconfigured, the repository refuses
 * unauthorized or deactivated actors.
 */
export async function verifyRepositoryActor(
  supabase: SupabaseClient,
  actorId: number | null | undefined,
  allowedRoles: readonly UserRole[]
): Promise<{ id: number; role: UserRole; is_active: boolean }> {
  if (!actorId || !Number.isInteger(actorId) || actorId <= 0) {
    throw new UnauthorizedError("Unauthorized — valid session required.");
  }

  const { data: actor, error } = await supabase
    .from("users")
    .select("id, role, is_active, is_approved")
    .eq("id", actorId)
    .maybeSingle();

  if (error || !actor || !actor.is_active || !actor.is_approved) {
    throw new UnauthorizedError("Unauthorized — account is inactive or not found.");
  }

  const dbRole = actor.role as UserRole;
  if (!allowedRoles.includes(dbRole)) {
    throw new ForbiddenError("Forbidden — insufficient permissions.");
  }

  return { id: Number(actor.id), role: dbRole, is_active: Boolean(actor.is_active) };
}
