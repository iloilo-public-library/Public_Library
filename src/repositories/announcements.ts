import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { AdminMutationError, getStaffDisplayName } from "@/repositories/shared";

export async function queryAnnouncements(
  supabase: SupabaseClient,
  sessionUserId: number | null
) {
  let query = supabase
    .from("announcements")
    .select("id, title, body, category, pinned, author, target_user_id, created_at")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (!sessionUserId) {
    query = query.is("target_user_id", null);
  }
  const { data, error } = await query;
  if (error) throw error;
  return { rows: data ?? [] };
}

export async function mutateAnnouncements(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (action === "delete") {
    if (!id) throw new AdminMutationError("Announcement ID is required.");
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id };
  }

  if (action === "toggle_pin") {
    if (!id) throw new AdminMutationError("Announcement ID is required.");
    const { error } = await supabase
      .from("announcements")
      .update({ pinned: Boolean(payload.pinned) })
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, id };
  }

  const title = String(payload.title ?? "").trim().slice(0, 120);
  const body = String(payload.body ?? "").trim();
  const category = ["general", "urgent", "event", "reminder"].includes(
    String(payload.category ?? "")
  )
    ? String(payload.category)
    : "general";

  if (!title || !body) {
    throw new AdminMutationError("Announcement title and message body are required.");
  }

  if (action === "create") {
    const author = await getStaffDisplayName(supabase, session.userId, session.role);
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title,
        body,
        category,
        pinned: Boolean(payload.pinned),
        author,
        target_user_id: null,
      })
      .select("id")
      .single();
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, id: data?.id };
  }

  if (action === "update") {
    if (!id) throw new AdminMutationError("Announcement ID is required.");
    const { error } = await supabase
      .from("announcements")
      .update({
        title,
        body,
        category,
        pinned: Boolean(payload.pinned),
      })
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, id };
  }

  throw new AdminMutationError(`Unknown announcements action: ${action}`);
}
