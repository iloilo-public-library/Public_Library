import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { isIsoDate } from "@/lib/circulation/rules";
import { formatZodError, mapDatabaseError } from "@/lib/errors";
import { AdminMutationError } from "@/repositories/shared";
import {
  libraryHolidayCreateSchema,
  libraryHolidayDeleteSchema,
  libraryHolidayUpdateSchema,
} from "@/validators/admin";

function isMissingRelationError(err: unknown): boolean {
  const code = String((err as { code?: unknown } | null)?.code ?? "");
  return code === "42P01" || code === "PGRST205";
}

function isUniqueViolation(err: unknown): boolean {
  const rec = (err && typeof err === "object" ? err : {}) as {
    code?: unknown;
    message?: unknown;
  };
  return (
    String(rec.code ?? "") === "23505" ||
    /duplicate key value violates unique constraint/i.test(String(rec.message ?? ""))
  );
}

export async function loadLibraryHolidayDateSet(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("library_holidays")
    .select("holiday_date");

  if (error) {
    if (isMissingRelationError(error)) {
      return new Set<string>();
    }
    throw mapDatabaseError(error, "Failed to load library holidays.");
  }

  const dates = new Set<string>();
  for (const row of data ?? []) {
    const iso = String((row as { holiday_date?: unknown }).holiday_date ?? "")
      .trim()
      .slice(0, 10);
    if (iso && isIsoDate(iso)) {
      dates.add(iso);
    }
  }
  return dates;
}

export interface QueryLibraryHolidaysOptions {
  actorId?: number | null;
  sessionToken?: string | null;
  from?: string;
  to?: string;
  q?: string;
}

export async function queryLibraryHolidays(
  supabase: SupabaseClient,
  options: QueryLibraryHolidaysOptions = {}
) {
  await verifyRepositoryActor(
    supabase,
    options.actorId,
    ["admin"],
    options.sessionToken
  );

  const from = options.from?.trim() || "";
  const to = options.to?.trim() || "";
  const q = options.q?.trim().toLowerCase() || "";

  if (from && !isIsoDate(from)) {
    throw new AdminMutationError("Invalid 'from' date filter. Use YYYY-MM-DD.", 400);
  }
  if (to && !isIsoDate(to)) {
    throw new AdminMutationError("Invalid 'to' date filter. Use YYYY-MM-DD.", 400);
  }

  let query = supabase
    .from("library_holidays")
    .select("id, holiday_date, name, created_by, created_at")
    .order("holiday_date", { ascending: true });

  if (from) {
    query = query.gte("holiday_date", from);
  }
  if (to) {
    query = query.lte("holiday_date", to);
  }

  const { data, error } = await query;
  if (error) {
    throw mapDatabaseError(error, "Failed to load library holidays.");
  }

  let rows = (data ?? []).map((row) => ({
    id: Number(row.id),
    holiday_date: String(row.holiday_date ?? "").slice(0, 10),
    name: String(row.name ?? ""),
    created_by: row.created_by !== null && row.created_by !== undefined ? Number(row.created_by) : null,
    created_at: row.created_at,
  }));

  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.holiday_date.toLowerCase().includes(q)
    );
  }

  return {
    rows,
    total: rows.length,
  };
}

export async function mutateLibraryHolidays(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const actor = await verifyRepositoryActor(
    supabase,
    session.userId,
    ["admin"],
    session.sessionToken
  );

  if (action === "create") {
    const parsed = libraryHolidayCreateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(formatZodError(parsed.error).message, 400);
    }

    const { holiday_date, name } = parsed.data;
    const { data, error } = await supabase
      .from("library_holidays")
      .insert({
        holiday_date,
        name,
        created_by: actor.id,
      })
      .select("id, holiday_date, name, created_by, created_at")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        throw new AdminMutationError(
          `A holiday is already configured for ${holiday_date}.`,
          409
        );
      }
      throw mapDatabaseError(error, "Failed to create library holiday.");
    }

    return {
      ok: true,
      id: Number(data.id),
      row: {
        ...data,
        id: Number(data.id),
        holiday_date: String(data.holiday_date ?? "").slice(0, 10),
      },
      audit_details: `action=create_holiday id=${data.id} date=${holiday_date} name=${name}`,
    };
  }

  if (action === "update") {
    if (!id || !Number.isInteger(id) || id <= 0) {
      throw new AdminMutationError("Holiday ID is required.", 400);
    }

    const parsed = libraryHolidayUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(formatZodError(parsed.error).message, 400);
    }

    const updates: Record<string, string> = {};
    if (parsed.data.holiday_date !== undefined) {
      updates.holiday_date = parsed.data.holiday_date;
    }
    if (parsed.data.name !== undefined) {
      updates.name = parsed.data.name;
    }

    const { data, error } = await supabase
      .from("library_holidays")
      .update(updates)
      .eq("id", id)
      .select("id, holiday_date, name, created_by, created_at")
      .maybeSingle();

    if (error) {
      if (isUniqueViolation(error)) {
        throw new AdminMutationError(
          `A holiday is already configured for ${parsed.data.holiday_date}.`,
          409
        );
      }
      throw mapDatabaseError(error, "Failed to update library holiday.");
    }

    if (!data) {
      throw new AdminMutationError("Library holiday not found.", 404);
    }

    return {
      ok: true,
      id: Number(data.id),
      row: {
        ...data,
        id: Number(data.id),
        holiday_date: String(data.holiday_date ?? "").slice(0, 10),
      },
      audit_details: `action=update_holiday id=${data.id} date=${String(data.holiday_date ?? "").slice(0, 10)} name=${data.name}`,
    };
  }

  if (action === "delete") {
    if (!id || !Number.isInteger(id) || id <= 0) {
      throw new AdminMutationError("Holiday ID is required.", 400);
    }

    const parsed = libraryHolidayDeleteSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(formatZodError(parsed.error).message, 400);
    }

    const { data, error } = await supabase
      .from("library_holidays")
      .delete()
      .eq("id", id)
      .select("id, holiday_date, name")
      .maybeSingle();

    if (error) {
      throw mapDatabaseError(error, "Failed to delete library holiday.");
    }

    if (!data) {
      throw new AdminMutationError("Library holiday not found.", 404);
    }

    return {
      ok: true,
      deletedId: id,
      audit_details: `action=delete_holiday id=${id} date=${String(data.holiday_date ?? "").slice(0, 10)} name=${data.name}`,
    };
  }

  throw new AdminMutationError(`Unknown library_holidays action: ${action}`, 400);
}
