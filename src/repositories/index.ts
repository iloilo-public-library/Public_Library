import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { AdminMutationError, requireAdminOnly } from "@/repositories/shared";
import { queryInventory, mutateInventory } from "@/repositories/inventory";
import { queryBooks, mutateBooks } from "@/repositories/books";
import { queryLibraryCards, mutateLibraryCards } from "@/repositories/library-cards";
import { queryReturns, mutateReturns } from "@/repositories/returns";
import { queryAccountsByRole, mutateAccounts } from "@/repositories/users";
import { queryAccountRequests, mutateAccountRequests } from "@/repositories/account-requests";
import {
  queryEvents,
  mutateEvents,
  queryEventCategories,
  mutateEventCategories,
  type QueryEventsOptions,
} from "@/repositories/events";
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

export interface AdminResourceQueryOptions extends QueryEventsOptions {
  page?: number;
  pageSize?: number;
  q?: string;
  isbn?: string;
  status?: string;
  category?: string;
  condition?: string;
  available?: boolean;
  damaged?: boolean;
  overdue?: boolean;
  format?: "json" | "csv";
  sort?: string;
  order?: "asc" | "desc";
}

export async function queryAdminResource(
  supabase: SupabaseClient,
  resource: string,
  sessionUserId: number | null,
  queryOptions?: AdminResourceQueryOptions,
  sessionRole?: string | null
) {
  const adminOnlyReadResources = new Set([
    "admins",
    "librarians",
    "system_settings",
    "error_logs",
    "backup_logs",
  ]);
  if (adminOnlyReadResources.has(resource) && sessionRole !== "admin") {
    throw new AdminMutationError("Forbidden — administrator privileges required.", 403);
  }

  switch (resource) {
    case "inventory":
      return queryInventory(supabase, queryOptions);

    case "books":
      return queryBooks(supabase, queryOptions);

    case "library_cards":
      return queryLibraryCards(supabase, {
        ...queryOptions,
        sessionRole: queryOptions?.sessionRole ?? sessionRole,
      });

    case "returns":
      return queryReturns(supabase, {
        ...queryOptions,
        sessionRole: queryOptions?.sessionRole ?? sessionRole,
      });

    case "users":
    case "librarians":
    case "admins":
      return queryAccountsByRole(supabase, resource);

    case "account_requests": {
      return queryAccountRequests(supabase, sessionRole);
    }

    case "events":
      return queryEvents(
        supabase,
        queryOptions
          ? { ...queryOptions, sessionRole: queryOptions.sessionRole ?? sessionRole }
          : { sessionRole }
      );

    case "event_categories":
      return queryEventCategories(supabase);

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
      return mutateAccountRequests(supabase, session, action, id, payload);

    case "users":
    case "librarians":
    case "admins":
      requireAdminOnly(session);
      return mutateAccounts(supabase, session, resource, action, id, payload);

    case "books":
      return mutateBooks(supabase, session, action, id, payload);

    case "inventory":
      return mutateInventory(supabase, session, action, id, payload);

    case "library_cards":
      return mutateLibraryCards(supabase, session, action, id, payload);

    case "returns":
      return mutateReturns(supabase, session, action, id, payload);

    case "events":
      return mutateEvents(supabase, session, action, id, payload);

    case "event_categories":
      return mutateEventCategories(supabase, session, action, id, payload);

    case "announcements":
      return mutateAnnouncements(supabase, session, action, id, payload);

    case "system_settings":
      requireAdminOnly(session);
      return mutateSystemSettings(supabase, session, action, payload);

    case "admin_profile":
      return mutateAdminProfile(supabase, session, action, payload);

    default:
      throw new AdminMutationError(`Unsupported resource: ${resource}`, 400);
  }
}
