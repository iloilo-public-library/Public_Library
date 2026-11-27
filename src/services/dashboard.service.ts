import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import {
  queryDashboardStats,
  queryStaffAppearance,
  upsertStaffAppearance,
} from "@/repositories/dashboard.repository";

export async function getDashboardStatsService(
  supabase: SupabaseClient,
  session: SessionPayload
) {
  return queryDashboardStats(supabase, session.userId, session.sessionToken);
}

export async function getStaffAppearanceService(
  supabase: SupabaseClient,
  session: SessionPayload
) {
  const appearance = await queryStaffAppearance(
    supabase,
    session.userId,
    session.sessionToken
  );
  return { ok: true as const, appearance };
}

export async function updateStaffAppearanceService(
  supabase: SupabaseClient,
  session: SessionPayload,
  input: { theme: string; language: string }
) {
  const saved = await upsertStaffAppearance(
    supabase,
    session.userId,
    input,
    session.sessionToken
  );

  await recordAuditEvent(
    {
      action: "update_staff_appearance",
      resource: "user_preferences",
      actorId: session.userId,
      targetId: session.userId,
      actorRole: session.role,
      route: "/api/staff/appearance",
      method: "PUT",
      details: `theme=${saved.theme} language=${saved.language}`,
    },
    supabase
  );

  return { ok: true as const, appearance: saved };
}
