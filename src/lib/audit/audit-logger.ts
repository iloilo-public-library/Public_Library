import type { SupabaseClient } from "@supabase/supabase-js";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { logger } from "@/lib/logger";

export interface AuditEventInput {
  action: string;
  resource: string;
  targetId?: string | number | null;
  actorEmail: string;
  actorRole: string;
  route?: string;
  method?: string;
  details?: string;
}

export async function recordAuditEvent(
  event: AuditEventInput,
  supabase?: SupabaseClient
): Promise<void> {
  const summary = `Audit [${event.actorRole}] ${event.action} ${event.resource}${
    event.targetId !== undefined && event.targetId !== null ? ` #${event.targetId}` : ""
  }`;

  logger.info(summary, {
    action: event.action,
    resource: event.resource,
    targetId: event.targetId ?? null,
    actorEmail: event.actorEmail,
    actorRole: event.actorRole,
  });

  await recordErrorLog(
    {
      level: "info",
      source: "API",
      route: event.route ?? `/api/admin/data?resource=${event.resource}`,
      method: event.method ?? "POST",
      status_code: 200,
      message: summary,
      details: event.details ?? "",
      user_email: event.actorEmail,
    },
    supabase
  );
}
