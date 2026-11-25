import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { STAFF_ROLES } from "@/config/constants";
import {
  AdminMutationError,
  formatFullName,
  getStaffDisplayName,
} from "@/repositories/shared";
import {
  announcementCreateSchema,
  announcementTogglePinSchema,
  announcementUpdateSchema,
} from "@/validators/admin";

export async function queryAnnouncements(
  supabase: SupabaseClient,
  sessionUserId: number | null
) {
  let query = supabase
    .from("announcements")
    .select("id, title, body, category, pinned, author, target_user_id, created_at")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  // Public / non-staff callers only ever receive broadcast announcements (target_user_id IS NULL)
  if (!sessionUserId) {
    query = query.is("target_user_id", null);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  if (!sessionUserId || rows.length === 0) {
    return {
      rows: rows.map((r) => ({ ...r, target_user_name: null as string | null })),
    };
  }

  // Staff view: attach recipient display name only (never email/contact details)
  const recipientIds = Array.from(
    new Set(
      rows
        .map((r) => r.target_user_id)
        .filter((uid): uid is number => typeof uid === "number" && uid > 0)
    )
  );

  const nameMap = new Map<number, string>();
  if (recipientIds.length > 0) {
    const { data: usersData } = await supabase
      .from("users")
      .select("id, firstname, lastname")
      .in("id", recipientIds);

    for (const u of usersData ?? []) {
      nameMap.set(Number(u.id), formatFullName(u.firstname, u.lastname));
    }
  }

  return {
    rows: rows.map((r) => ({
      ...r,
      target_user_name:
        typeof r.target_user_id === "number"
          ? (nameMap.get(r.target_user_id) ?? "Member")
          : null,
    })),
  };
}

export async function mutateAnnouncements(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  await verifyRepositoryActor(supabase, session.userId, STAFF_ROLES);

  if (action === "delete") {
    if (!id) throw new AdminMutationError("Announcement ID is required.");
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id, audit_details: `action=delete_announcement id=${id}` };
  }

  if (action === "toggle_pin") {
    if (!id) throw new AdminMutationError("Announcement ID is required.");
    const parsed = announcementTogglePinSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Invalid pin value.",
        400
      );
    }
    const { error } = await supabase
      .from("announcements")
      .update({ pinned: parsed.data.pinned })
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      id,
      audit_details: `action=toggle_pin id=${id} pinned=${parsed.data.pinned}`,
    };
  }

  if (action === "create") {
    const parsed = announcementCreateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message ||
          "Announcement title and message body are required.",
        400
      );
    }

    const { title, body, category, pinned, target_user_id } = parsed.data;
    let targetUserName: string | null = null;

    if (target_user_id !== null) {
      const { data: recipient, error: recErr } = await supabase
        .from("users")
        .select("id, firstname, lastname, role, is_active, is_approved")
        .eq("id", target_user_id)
        .single();

      if (recErr || !recipient) {
        throw new AdminMutationError("Selected recipient was not found.", 400);
      }
      if (
        recipient.role !== "user" ||
        !recipient.is_active ||
        !recipient.is_approved
      ) {
        throw new AdminMutationError(
          "Selected recipient must be an active library member.",
          400
        );
      }
      targetUserName = formatFullName(recipient.firstname, recipient.lastname);
    }

    const author = await getStaffDisplayName(supabase, session.userId, session.role);
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title,
        body,
        category,
        pinned,
        author,
        target_user_id,
      })
      .select("id")
      .single();

    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      id: data?.id,
      target_user_id,
      target_user_name: targetUserName,
    };
  }

  if (action === "update") {
    if (!id) throw new AdminMutationError("Announcement ID is required.");
    const parsed = announcementUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message ||
          "Announcement title and message body are required.",
        400
      );
    }

    const { title, body, category, pinned } = parsed.data;
    const { error } = await supabase
      .from("announcements")
      .update({
        title,
        body,
        category,
        pinned,
      })
      .eq("id", id);

    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, id };
  }

  throw new AdminMutationError(`Unknown announcements action: ${action}`);
}
