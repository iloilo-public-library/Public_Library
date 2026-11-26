import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/config/constants";
import { AppError } from "@/lib/errors";

export interface SystemModeSettings {
  maintenance_enabled?: boolean | null;
  maintenance_message?: string | null;
  bypass_role?: string | null;
  lockdown_enabled?: boolean | null;
}

export interface SystemModeDecision {
  allowed: boolean;
  code?: "SYSTEM_LOCKDOWN" | "MAINTENANCE_MODE";
  message?: string;
}

/**
 * Evaluates emergency lockdown and maintenance mode rules matching legacy-flask/app.py.
 * Admins are NEVER locked out under either mode.
 */
export function evaluateSystemMode(
  settings: SystemModeSettings | null | undefined,
  role: UserRole | string | null | undefined
): SystemModeDecision {
  if (!settings) return { allowed: true };

  // Lockdown takes priority over maintenance mode
  if (settings.lockdown_enabled) {
    if (role === "admin") {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: "SYSTEM_LOCKDOWN",
      message:
        "The system is temporarily locked for security reasons. Please try again later or contact an administrator.",
    };
  }

  if (settings.maintenance_enabled) {
    if (role === "admin") {
      return { allowed: true };
    }
    if (role === "librarian" && settings.bypass_role === "admin_librarian") {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: "MAINTENANCE_MODE",
      message:
        String(settings.maintenance_message ?? "").trim() ||
        "The library system is currently under scheduled maintenance. Please try again shortly.",
    };
  }

  return { allowed: true };
}

/**
 * Fetches system_settings (row id=1) and enforces lockdown/maintenance for non-admin roles.
 * Fails open only if the system_settings table is unreachable (e.g., before initial migration).
 */
export async function enforceSystemMode(
  supabase: SupabaseClient,
  role: UserRole | string | null | undefined
): Promise<void> {
  if (role === "admin") return;

  let settings: SystemModeSettings | null = null;
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("maintenance_enabled, maintenance_message, bypass_role, lockdown_enabled")
      .limit(1);
    if (!error && Array.isArray(data) && data.length > 0) {
      settings = data[0] as SystemModeSettings;
    }
  } catch {
    return;
  }

  const decision = evaluateSystemMode(settings, role);
  if (!decision.allowed) {
    throw new AppError(
      decision.message || "Service temporarily unavailable.",
      503,
      decision.code || "SERVICE_UNAVAILABLE"
    );
  }
}
