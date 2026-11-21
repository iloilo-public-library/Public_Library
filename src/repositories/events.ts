import type { SupabaseClient } from "@supabase/supabase-js";
import { AdminMutationError } from "@/repositories/shared";

export async function queryEvents(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, event_date, start_time, end_time, location, category")
    .order("event_date", { ascending: true });
  if (error) throw error;
  return { rows: data ?? [] };
}

export async function mutateEvents(
  supabase: SupabaseClient,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (action === "delete") {
    if (!id) throw new AdminMutationError("Event ID is required.");
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id };
  }

  const title = String(payload.title ?? "").trim();
  const eventDate = String(payload.event_date ?? "").trim();
  if (!title || !eventDate) {
    throw new AdminMutationError("Event title and date are required.");
  }

  const eventData = {
    title,
    description: String(payload.description ?? "").trim() || null,
    event_date: eventDate,
    start_time: String(payload.start_time ?? "").trim() || null,
    end_time: String(payload.end_time ?? "").trim() || null,
    location: String(payload.location ?? "").trim() || null,
    category: String(payload.category ?? "general").trim().toLowerCase() || "general",
  };

  if (action === "create") {
    const { data, error } = await supabase
      .from("events")
      .insert(eventData)
      .select("id")
      .single();
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, id: data?.id };
  }

  if (action === "update") {
    if (!id) throw new AdminMutationError("Event ID is required.");
    const { error } = await supabase.from("events").update(eventData).eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, id };
  }

  throw new AdminMutationError(`Unknown events action: ${action}`);
}
