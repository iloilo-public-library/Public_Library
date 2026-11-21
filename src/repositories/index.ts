import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { AdminMutationError, requireAdminOnly } from "@/repositories/shared";
import { queryInventory, mutateInventory } from "@/repositories/inventory";
import { queryBooks, mutateBooks } from "@/repositories/books";
import { queryLibraryCards, mutateLibraryCards } from "@/repositories/library-cards";
import { queryReturns, mutateReturns } from "@/repositories/returns";
import { queryAccountsByRole, mutateAccounts } from "@/repositories/users";
import { queryAccountRequests, mutateAccountRequests } from "@/repositories/account-requests";
import { queryEvents, mutateEvents } from "@/repositories/events";
import { queryAnnouncements, mutateAnnouncements } from "@/repositories/announcements";
import {
  queryBackupLogs,
  queryErrorLogs,
  querySystemSettings,
  mutateSystemSettings,
} from "@/repositories/system-settings";
import { queryAdminProfile, mutateAdminProfile } from "@/repositories/admin-profile";

export { AdminMutationError };
export * from "@/repositories/inventory";
export * from "@/repositories/books";
export * from "@/repositories/library-cards";
export * from "@/repositories/returns";
export * from "@/repositories/users";
export * from "@/repositories/account-requests";
export * from "@/repositories/events";
export * from "@/repositories/announcements";
export * from "@/repositories/system-settings";
export * from "@/repositories/admin-profile";

export async function queryAdminResource(
  supabase: SupabaseClient,
  resource: string,
  sessionUserId: number | null
) {
  switch (resource) {
    case "inventory":
      return queryInventory(supabase);

    case "books":
      return queryBooks(supabase);

    case "library_cards":
      return queryLibraryCards(supabase);

    case "returns":
      return queryReturns(supabase);

    case "users":
    case "librarians":
    case "admins":
      return queryAccountsByRole(supabase, resource);

    case "account_requests":
      return queryAccountRequests(supabase);

    case "events":
      return queryEvents(supabase);

    case "announcements":
      return queryAnnouncements(supabase, sessionUserId);

    case "system_settings":
      return querySystemSettings(supabase);

    case "error_logs":
      return queryErrorLogs(supabase);

    case "backup_logs":
      return queryBackupLogs(supabase);

    case "admin_profile":
      return queryAdminProfile(supabase, sessionUserId);

    default:
      return { rows: [] };
  }
}

export async function handleAdminMutation(
  supabase: SupabaseClient,
  session: SessionPayload,
  resource: string,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (resource) {
    case "account_requests":
      requireAdminOnly(session);
      return mutateAccountRequests(supabase, session, action, id, payload);

    case "users":
    case "librarians":
    case "admins":
      requireAdminOnly(session);
      return mutateAccounts(supabase, session, resource, action, id, payload);

    case "books":
      return mutateBooks(supabase, action, id, payload);

    case "inventory":
      return mutateInventory(supabase, id, payload);

    case "library_cards":
      return mutateLibraryCards(supabase, session, action, id, payload);

    case "returns":
      return mutateReturns(supabase, session, action, id, payload);

    case "events":
      return mutateEvents(supabase, action, id, payload);

    case "announcements":
      return mutateAnnouncements(supabase, session, action, id, payload);

    case "system_settings":
      requireAdminOnly(session);
      return mutateSystemSettings(supabase, action, payload);

    case "admin_profile":
      return mutateAdminProfile(supabase, session, action, payload);

    default:
      throw new AdminMutationError(`Unsupported resource: ${resource}`, 400);
  }
}
