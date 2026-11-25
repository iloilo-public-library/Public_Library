import type { SupabaseClient } from "@supabase/supabase-js";
import { recordErrorLog } from "@/lib/audit/error-logger";
import { logger } from "@/lib/logger";

export interface AuditEventInput {
  action: string;
  resource: string;
  actorId?: number | string | null;
  targetId?: string | number | null;
  actorEmail?: string;
  actorRole: string;
  route?: string;
  method?: string;
  details?: string;
}

const SENSITIVE_DETAIL_RE =
  /\b(password|current_password|new_password|confirm_password|pin|pin_code|otp|otp_code|token|reset_token|secret)\s*[=:]\s*\S+/gi;

function scrubSensitiveDetails(details: string | undefined): string {
  if (!details) return "";
  return details.replace(SENSITIVE_DETAIL_RE, "$1=[REDACTED]").slice(0, 1000);
}

export async function recordAuditEvent(
  event: AuditEventInput,
  supabase?: SupabaseClient
): Promise<void> {
  const nowIso = new Date().toISOString();
  const actorTag =
    event.actorId !== undefined && event.actorId !== null
      ? `actor_id=${event.actorId}`
      : event.actorEmail
        ? `actor=${event.actorEmail}`
        : "actor=system";
  const targetTag =
    event.targetId !== undefined && event.targetId !== null
      ? `target_id=${event.targetId}`
      : "target_id=none";

  const summary = `Audit [${event.actorRole}] ${event.action} ${event.resource}${
    event.targetId !== undefined && event.targetId !== null ? ` #${event.targetId}` : ""
  }`;

  const safeExtra = scrubSensitiveDetails(event.details);
  const fullDetails = [actorTag, targetTag, `at=${nowIso}`, safeExtra]
    .filter(Boolean)
    .join(" | ");

  logger.info(summary, {
    action: event.action,
    resource: event.resource,
    actorId: event.actorId ?? null,
    targetId: event.targetId ?? null,
    actorRole: event.actorRole,
    timestamp: nowIso,
  });

  await recordErrorLog(
    {
      level: "info",
      source: "API",
      route: event.route ?? `/api/admin/data?resource=${event.resource}`,
      method: event.method ?? "POST",
      status_code: 200,
      message: summary,
      details: fullDetails,
      user_email:
        event.actorId !== undefined && event.actorId !== null
          ? `user#${event.actorId}`
          : event.actorEmail ?? "",
    },
    supabase
  );
}
