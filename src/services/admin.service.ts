import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import {
  AdminMutationError,
  handleAdminMutation,
  queryAdminResource,
} from "@/repositories";
import { recordAuditEvent } from "@/lib/audit/audit-logger";
import type { AdminResource } from "@/validators/admin";

export { AdminMutationError };

export async function getAdminResourceData(
  supabase: SupabaseClient,
  resource: AdminResource,
  sessionUserId: number | null
) {
  return queryAdminResource(supabase, resource, sessionUserId);
}

export async function executeAdminMutation(
  supabase: SupabaseClient,
  session: SessionPayload,
  params: {
    resource: AdminResource;
    action: string;
    id: number | null;
    payload: Record<string, unknown>;
    method?: string;
  }
): Promise<Record<string, unknown>> {
  const result = await handleAdminMutation(
    supabase,
    session,
    params.resource,
    params.action,
    params.id,
    params.payload
  );

  await recordAuditEvent(
    {
      action: params.action,
      resource: params.resource,
      targetId: params.id ?? (typeof result.id === "number" ? result.id : null),
      actorEmail: session.email,
      actorRole: session.role,
      route: `/api/admin/data?resource=${params.resource}`,
      method: params.method ?? "POST",
    },
    supabase
  );

  return result;
}
