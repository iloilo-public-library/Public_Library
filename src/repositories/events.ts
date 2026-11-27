import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { STAFF_ROLES } from "@/config/constants";
import { AdminMutationError } from "@/repositories/shared";
import {
  BUILTIN_EVENT_CATEGORIES,
  eventCategoryCreateSchema,
  eventCategoryUpdateSchema,
  eventCreateSchema,
  eventDeleteScopeSchema,
  eventQueryRangeSchema,
  eventRescheduleSchema,
  eventUpdateSchema,
} from "@/validators/events";
import {
  computeSplitUntilDate,
  expandEventsForRange,
  type EventExceptionRecord,
  type MasterEventRecord,
} from "@/lib/calendar/recurrence";
import { deleteEventCoverByRef } from "@/lib/storage";
import { logger } from "@/lib/logger";

const EXTENDED_EVENT_SELECT =
  "id, title, description, event_date, end_date, start_time, end_time, all_day, timezone, location, category, audience, cover_image, image, recurrence_freq, recurrence_interval, recurrence_weekdays, recurrence_day_of_month, recurrence_until, recurrence_count";

const BASE_EVENT_SELECT =
  "id, title, description, event_date, start_time, end_time, location, category, image";

const DEFAULT_CATEGORY_ROWS = [
  { id: 1, slug: "general", name: "General", color: "#48c78e", is_system: true },
  { id: 2, slug: "workshop", name: "Workshop / Seminar", color: "#9fc1e1", is_system: true },
  { id: 3, slug: "holiday", name: "Holiday", color: "#f7c94b", is_system: true },
  { id: 4, slug: "exhibit", name: "Exhibit", color: "#c882ff", is_system: true },
  { id: 5, slug: "closure", name: "Closure / Cancelled", color: "#ff6363", is_system: true },
];

export interface QueryEventsOptions {
  from?: string;
  to?: string;
  isStaff?: boolean;
  sessionRole?: string | null;
  actorId?: number | null;
  sessionToken?: string | null;
}

async function fetchValidCategorySlugs(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from("event_categories").select("slug");
  if (error || !data || data.length === 0) {
    return new Set<string>(BUILTIN_EVENT_CATEGORIES);
  }
  return new Set<string>(data.map((r) => String(r.slug).toLowerCase()));
}

async function fetchRemindersMap(
  supabase: SupabaseClient,
  eventIds: number[]
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (eventIds.length === 0) return map;
  const { data, error } = await supabase
    .from("event_reminders")
    .select("event_id, remind_before_minutes")
    .in("event_id", eventIds);
  if (error || !data) return map;
  for (const row of data) {
    const eid = Number(row.event_id);
    const list = map.get(eid) ?? [];
    list.push(Number(row.remind_before_minutes));
    map.set(eid, list);
  }
  for (const [k, list] of map.entries()) {
    map.set(k, list.sort((a, b) => a - b));
  }
  return map;
}

async function syncEventReminders(
  supabase: SupabaseClient,
  eventId: number,
  offsets: number[] | undefined
): Promise<void> {
  if (offsets === undefined) return;
  const unique = Array.from(new Set(offsets)).sort((a, b) => a - b);
  const { error: delErr } = await supabase.from("event_reminders").delete().eq("event_id", eventId);
  if (delErr) {
    logger.warn("event_reminders sync skipped (table unavailable)", { eventId });
    return;
  }
  if (unique.length === 0) return;
  const rows = unique.map((m) => ({ event_id: eventId, remind_before_minutes: m }));
  const { error: insErr } = await supabase.from("event_reminders").insert(rows);
  if (insErr) {
    throw new AdminMutationError(`Failed to save event reminders: ${insErr.message}`, 500);
  }
}

export async function queryEvents(
  supabase: SupabaseClient,
  options: QueryEventsOptions = {}
) {
  const { from, to, isStaff = false, sessionRole = null, actorId = null, sessionToken = null } = options;

  const claimsStaffAccess = Boolean(
    isStaff || sessionRole === "admin" || sessionRole === "librarian"
  );
  if (claimsStaffAccess) {
    await verifyRepositoryActor(supabase, actorId, STAFF_ROLES, sessionToken);
  }

  if (from || to) {
    const parsedRange = eventQueryRangeSchema.safeParse({ from, to });
    if (!parsedRange.success) {
      throw new AdminMutationError(
        parsedRange.error.issues[0]?.message || "Invalid date range.",
        400
      );
    }
  }

  let extendedAvailable = true;
  let { data, error } = await supabase
    .from("events")
    .select(EXTENDED_EVENT_SELECT)
    .order("event_date", { ascending: true });

  if (error) {
    extendedAvailable = false;
    const fallback = await supabase
      .from("events")
      .select(BASE_EVENT_SELECT)
      .order("event_date", { ascending: true });
    if (fallback.error) throw fallback.error;
    data = (fallback.data ?? []) as unknown as typeof data;
  }

  let masters = ((data ?? []) as unknown as MasterEventRecord[]).map((row) => ({
    ...row,
    cover_image: row.cover_image ?? row.image ?? null,
    all_day:
      row.all_day !== undefined && row.all_day !== null
        ? Boolean(row.all_day)
        : !row.start_time && !row.end_time,
    timezone: row.timezone || "Asia/Manila",
    audience: row.audience || "all",
  }));

  const effectiveStaff = Boolean(
    isStaff || sessionRole === "admin" || sessionRole === "librarian"
  );
  const isAuthenticatedMember = !effectiveStaff && Boolean(sessionRole);

  if (!effectiveStaff) {
    if (isAuthenticatedMember) {
      masters = masters.filter((m) => (m.audience || "all") !== "staff");
    } else {
      masters = masters.filter((m) => (m.audience || "all") === "all");
    }
  }

  const eventIds = masters.map((m) => m.id);
  const remindersMap = extendedAvailable
    ? await fetchRemindersMap(supabase, eventIds)
    : new Map<number, number[]>();

  if (from && to) {
    let exceptions: EventExceptionRecord[] = [];
    if (extendedAvailable && eventIds.length > 0) {
      const exRes = await supabase
        .from("event_exceptions")
        .select("*")
        .in("event_id", eventIds);
      if (!exRes.error && exRes.data) {
        exceptions = exRes.data as EventExceptionRecord[];
      }
    }

    const { occurrences, truncated } = expandEventsForRange(masters, exceptions, from, to);
    const rows = occurrences.map((occ) => ({
      ...occ,
      reminders: remindersMap.get(occ.master_id) ?? [],
    }));
    return { rows, truncated, range: { from, to } };
  }

  const rows = masters.map((m) => ({
    ...m,
    master_id: m.id,
    occurrence_date: (m.event_date || "").slice(0, 10),
    is_recurring: Boolean(m.recurrence_freq),
    reminders: remindersMap.get(m.id) ?? [],
  }));
  return { rows };
}

export async function mutateEvents(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await verifyRepositoryActor(supabase, session.userId, STAFF_ROLES, session.sessionToken);

  if (action === "delete") {
    if (!id) throw new AdminMutationError("Event ID is required.", 400);
    const parsedDel = eventDeleteScopeSchema.safeParse(payload);
    if (!parsedDel.success) {
      throw new AdminMutationError(parsedDel.error.issues[0]?.message || "Invalid delete scope.", 400);
    }
    const { scope, occurrence_date } = parsedDel.data;

    let { data: existing, error: existErr } = await supabase
      .from("events")
      .select("id, event_date, cover_image, image, recurrence_freq")
      .eq("id", id)
      .maybeSingle();

    if (existErr) {
      const fallback = await supabase
        .from("events")
        .select("id, event_date, image")
        .eq("id", id)
        .maybeSingle();
      existing = fallback.data
        ? ({ ...fallback.data, cover_image: null, recurrence_freq: null } as typeof existing)
        : null;
    }

    if (!existing) throw new AdminMutationError("Event not found.", 404);

    if (existing.recurrence_freq && scope === "this") {
      const origDate = occurrence_date || String(existing.event_date).slice(0, 10);
      const { error } = await supabase.from("event_exceptions").upsert(
        { event_id: id, original_date: origDate, action: "skipped" },
        { onConflict: "event_id,original_date" }
      );
      if (error) throw new AdminMutationError(error.message, 500);
      return { ok: true, id, scope: "this", occurrence_date: origDate, audit_details: `scope=this date=${origDate}` };
    }

    if (existing.recurrence_freq && scope === "following") {
      const origDate = occurrence_date || String(existing.event_date).slice(0, 10);
      const untilDate = computeSplitUntilDate(origDate);
      const { error } = await supabase
        .from("events")
        .update({ recurrence_until: untilDate })
        .eq("id", id);
      if (error) throw new AdminMutationError(error.message, 500);
      return { ok: true, id, scope: "following", recurrence_until: untilDate, audit_details: `scope=following until=${untilDate}` };
    }

    const oldCover = (existing.cover_image as string | null) || (existing.image as string | null);
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    if (oldCover) void deleteEventCoverByRef(oldCover);
    return { ok: true, deletedId: id, scope: "all", audit_details: "scope=all" };
  }

  if (action === "reschedule") {
    if (!id) throw new AdminMutationError("Event ID is required.", 400);
    const parsed = eventRescheduleSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(parsed.error.issues[0]?.message || "Invalid reschedule data.", 400);
    }
    const d = parsed.data;
    const scope = d.scope ?? "all";
    let { data: existing, error: existErr } = await supabase
      .from("events")
      .select(EXTENDED_EVENT_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (existErr) {
      const fallback = await supabase
        .from("events")
        .select(BASE_EVENT_SELECT)
        .eq("id", id)
        .maybeSingle();
      existing = fallback.data as typeof existing;
    }
    if (!existing) throw new AdminMutationError("Event not found.", 404);

    if (existing.recurrence_freq && scope === "this") {
      const origDate = d.occurrence_date || String(existing.event_date).slice(0, 10);
      const { error } = await supabase.from("event_exceptions").upsert(
        {
          event_id: id,
          original_date: origDate,
          action: "modified",
          event_date: d.event_date,
          end_date: d.end_date ?? null,
          start_time: d.all_day ? null : d.start_time ?? null,
          end_time: d.all_day ? null : d.end_time ?? null,
          all_day: d.all_day ?? existing.all_day ?? false,
        },
        { onConflict: "event_id,original_date" }
      );
      if (error) throw new AdminMutationError(error.message, 500);
      return { ok: true, id, scope: "this", audit_details: `reschedule scope=this date=${d.event_date}` };
    }

    if (existing.recurrence_freq && scope === "following") {
      const origDate = d.occurrence_date || d.event_date;
      const splitUntil = computeSplitUntilDate(origDate);
      const { error: truncErr } = await supabase
        .from("events")
        .update({ recurrence_until: splitUntil })
        .eq("id", id);
      if (truncErr) throw new AdminMutationError(truncErr.message, 500);

      const isAllDay = d.all_day ?? (!d.start_time && !d.end_time);
      const splitEventData: Record<string, unknown> = {
        title: existing.title,
        description: existing.description ?? null,
        event_date: d.event_date,
        end_date: d.end_date ?? null,
        start_time: isAllDay ? null : d.start_time ?? null,
        end_time: isAllDay ? null : d.end_time ?? null,
        all_day: isAllDay,
        timezone: existing.timezone || "Asia/Manila",
        location: existing.location ?? null,
        category: existing.category || "general",
        audience: existing.audience || "all",
        cover_image: existing.cover_image ?? null,
        image: existing.image ?? existing.cover_image ?? null,
        recurrence_freq: existing.recurrence_freq,
        recurrence_interval: existing.recurrence_interval ?? 1,
        recurrence_weekdays: existing.recurrence_weekdays ?? null,
        recurrence_day_of_month: existing.recurrence_day_of_month ?? null,
        recurrence_until: existing.recurrence_until ?? null,
        recurrence_count: existing.recurrence_count ?? null,
      };

      const { data: created, error: insErr } = await supabase
        .from("events")
        .insert(splitEventData)
        .select("id")
        .single();
      if (insErr) throw new AdminMutationError(insErr.message, 500);

      const splitId = Number(created?.id);
      const remindersMap = await fetchRemindersMap(supabase, [id]);
      const existingReminders = remindersMap.get(id);
      if (existingReminders && existingReminders.length > 0) {
        await syncEventReminders(supabase, splitId, existingReminders);
      }

      return {
        ok: true,
        id: splitId,
        previous_master_id: id,
        scope: "following",
        recurrence_until: splitUntil,
        audit_details: `reschedule scope=following split_from=${id} new_id=${splitId} date=${d.event_date}`,
      };
    }

    const updateFields: Record<string, unknown> = {
      event_date: d.event_date,
      end_date: d.end_date ?? null,
      start_time: d.all_day ? null : d.start_time ?? null,
      end_time: d.all_day ? null : d.end_time ?? null,
      all_day: d.all_day ?? (!d.start_time && !d.end_time),
    };
    const { error } = await supabase.from("events").update(updateFields).eq("id", id);
    if (error) {
      const fallbackErr = await supabase
        .from("events")
        .update({
          event_date: d.event_date,
          start_time: d.all_day ? null : d.start_time ?? null,
          end_time: d.all_day ? null : d.end_time ?? null,
        })
        .eq("id", id);
      if (fallbackErr.error) throw new AdminMutationError(fallbackErr.error.message, 500);
    }
    return { ok: true, id, scope, audit_details: `reschedule date=${d.event_date}` };
  }

  const schema = action === "create" ? eventCreateSchema : eventUpdateSchema;
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new AdminMutationError(parsed.error.issues[0]?.message || "Invalid event data.", 400);
  }
  const d = parsed.data;

  const validSlugs = await fetchValidCategorySlugs(supabase);
  const categorySlug = d.category.toLowerCase();
  if (!validSlugs.has(categorySlug)) {
    throw new AdminMutationError(`Unknown event category: ${d.category}`, 400);
  }

  const coverRef = d.cover_image !== undefined ? d.cover_image : d.image;
  const isAllDay = d.all_day ?? (!d.start_time && !d.end_time);

  const fullEventData: Record<string, unknown> = {
    title: d.title,
    description: d.description || null,
    event_date: d.event_date,
    end_date: d.end_date ?? null,
    start_time: isAllDay ? null : d.start_time || null,
    end_time: isAllDay ? null : d.end_time || null,
    all_day: isAllDay,
    timezone: d.timezone || "Asia/Manila",
    location: d.location || null,
    category: categorySlug,
    audience: d.audience || "all",
  };

  if (coverRef !== undefined) {
    fullEventData.cover_image = coverRef;
    fullEventData.image = coverRef;
  }

  if (d.recurrence !== undefined) {
    if (d.recurrence === null) {
      fullEventData.recurrence_freq = null;
      fullEventData.recurrence_interval = null;
      fullEventData.recurrence_weekdays = null;
      fullEventData.recurrence_day_of_month = null;
      fullEventData.recurrence_until = null;
      fullEventData.recurrence_count = null;
    } else {
      fullEventData.recurrence_freq = d.recurrence.freq;
      fullEventData.recurrence_interval = d.recurrence.interval ?? 1;
      fullEventData.recurrence_weekdays = d.recurrence.weekdays ?? null;
      fullEventData.recurrence_day_of_month = d.recurrence.day_of_month ?? null;
      fullEventData.recurrence_until = d.recurrence.until ?? null;
      fullEventData.recurrence_count = d.recurrence.count ?? null;
    }
  }

  const baseEventData: Record<string, unknown> = {
    title: d.title,
    description: d.description || null,
    event_date: d.event_date,
    start_time: isAllDay ? null : d.start_time || null,
    end_time: isAllDay ? null : d.end_time || null,
    location: d.location || null,
    category: categorySlug,
    ...(coverRef !== undefined ? { image: coverRef } : {}),
  };

  if (action === "create") {
    let { data, error } = await supabase.from("events").insert(fullEventData).select("id").single();
    if (error) {
      const fb = await supabase.from("events").insert(baseEventData).select("id").single();
      if (fb.error) throw new AdminMutationError(fb.error.message, 500);
      data = fb.data;
    }
    const newId = Number(data?.id);
    await syncEventReminders(supabase, newId, d.reminders);
    return {
      ok: true,
      id: newId,
      cover_image: coverRef ?? null,
      audit_details: coverRef ? "cover_uploaded=true" : undefined,
    };
  }

  if (action === "update") {
    if (!id) throw new AdminMutationError("Event ID is required.", 400);
    const scope = d.scope ?? "all";

    let { data: existing, error: existErr } = await supabase
      .from("events")
      .select("id, event_date, cover_image, image, recurrence_freq")
      .eq("id", id)
      .maybeSingle();

    if (existErr) {
      const fallback = await supabase
        .from("events")
        .select("id, event_date, image")
        .eq("id", id)
        .maybeSingle();
      existing = fallback.data
        ? ({ ...fallback.data, cover_image: null, recurrence_freq: null } as typeof existing)
        : null;
    }

    if (!existing) throw new AdminMutationError("Event not found.", 404);
    const oldCover = (existing.cover_image as string | null) || (existing.image as string | null);

    if (existing.recurrence_freq && scope === "this") {
      const origDate = d.occurrence_date || String(existing.event_date).slice(0, 10);
      const { error } = await supabase.from("event_exceptions").upsert(
        {
          event_id: id,
          original_date: origDate,
          action: "modified",
          title: d.title,
          description: d.description || null,
          event_date: d.event_date,
          end_date: d.end_date ?? null,
          start_time: isAllDay ? null : d.start_time || null,
          end_time: isAllDay ? null : d.end_time || null,
          all_day: isAllDay,
          location: d.location || null,
          category: categorySlug,
          ...(coverRef !== undefined ? { cover_image: coverRef } : {}),
        },
        { onConflict: "event_id,original_date" }
      );
      if (error) throw new AdminMutationError(error.message, 500);
      return { ok: true, id, scope: "this", occurrence_date: origDate, audit_details: `scope=this date=${origDate}` };
    }

    if (existing.recurrence_freq && scope === "following") {
      const origDate = d.occurrence_date || d.event_date;
      const splitUntil = computeSplitUntilDate(origDate);
      const { error: truncErr } = await supabase
        .from("events")
        .update({ recurrence_until: splitUntil })
        .eq("id", id);
      if (truncErr) throw new AdminMutationError(truncErr.message, 500);

      const { data: created, error: insErr } = await supabase
        .from("events")
        .insert(fullEventData)
        .select("id")
        .single();
      if (insErr) throw new AdminMutationError(insErr.message, 500);
      const splitId = Number(created?.id);
      await syncEventReminders(supabase, splitId, d.reminders);
      return {
        ok: true,
        id: splitId,
        previous_master_id: id,
        scope: "following",
        audit_details: `scope=following split_from=${id} new_id=${splitId}`,
      };
    }

    const { error } = await supabase.from("events").update(fullEventData).eq("id", id);
    if (error) {
      const fb = await supabase.from("events").update(baseEventData).eq("id", id);
      if (fb.error) throw new AdminMutationError(fb.error.message, 500);
    }

    await syncEventReminders(supabase, id, d.reminders);

    let coverAudit = "";
    if (coverRef !== undefined && oldCover && oldCover !== coverRef) {
      void deleteEventCoverByRef(oldCover);
      coverAudit = coverRef ? "cover_replaced=true" : "cover_removed=true";
    }

    return {
      ok: true,
      id,
      scope: "all",
      cover_image: coverRef !== undefined ? coverRef : oldCover,
      audit_details: coverAudit || undefined,
    };
  }

  throw new AdminMutationError(`Unknown events action: ${action}`, 400);
}

export async function queryEventCategories(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("event_categories")
    .select("id, slug, name, color, is_system")
    .order("id", { ascending: true });
  if (error || !data) return { rows: DEFAULT_CATEGORY_ROWS };
  return { rows: data };
}

export async function mutateEventCategories(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await verifyRepositoryActor(supabase, session.userId, ["admin"], session.sessionToken);

  if (action === "create") {
    const parsed = eventCategoryCreateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(parsed.error.issues[0]?.message || "Invalid category.", 400);
    }
    const { data, error } = await supabase
      .from("event_categories")
      .insert({ ...parsed.data, is_system: false })
      .select("id, slug, name, color")
      .single();
    if (error) throw new AdminMutationError(error.message, error.code === "23505" ? 409 : 500);
    return { ok: true, id: data.id, category: data, audit_details: `category_create=${data.slug}` };
  }

  if (action === "update") {
    if (!id) throw new AdminMutationError("Category ID is required.", 400);
    const parsed = eventCategoryUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(parsed.error.issues[0]?.message || "Invalid category update.", 400);
    }
    const { data, error } = await supabase
      .from("event_categories")
      .update(parsed.data)
      .eq("id", id)
      .select("id, slug, name, color")
      .single();
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, id, category: data, audit_details: `category_update=${data.slug}` };
  }

  if (action === "delete") {
    if (!id) throw new AdminMutationError("Category ID is required.", 400);
    const { data: cat } = await supabase
      .from("event_categories")
      .select("id, slug, is_system")
      .eq("id", id)
      .maybeSingle();
    if (!cat) throw new AdminMutationError("Category not found.", 404);
    if (cat.is_system) throw new AdminMutationError("Built-in categories cannot be deleted.", 409);
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("category", cat.slug);
    if ((count ?? 0) > 0) {
      throw new AdminMutationError(
        `Cannot delete category "${cat.slug}" because ${count} event(s) still use it.`,
        409
      );
    }
    const { error } = await supabase.from("event_categories").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id, audit_details: `category_delete=${cat.slug}` };
  }

  throw new AdminMutationError(`Unknown event_categories action: ${action}`, 400);
}
