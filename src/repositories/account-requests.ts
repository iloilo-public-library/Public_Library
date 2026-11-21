import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import {
  AdminMutationError,
  formatFullName,
  getStaffDisplayName,
  resolveEmail,
} from "@/repositories/shared";

export async function queryAccountRequests(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("account_requests")
    .select(
      "id, user_id, username, request_type, reason, status, admin_note, created_at, reviewed_at, card_id, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date"
    )
    .order("id", { ascending: false });
  if (error) throw error;

  const userIds = Array.from(
    new Set((data ?? []).map((r) => r.user_id as number).filter(Boolean))
  );
  const userMap = new Map<number, Record<string, unknown>>();
  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .from("users")
      .select(
        "id, username, email_display, firstname, lastname, age, gender, phone_number, school, city, province, education_level, occupation, is_government, office_phone, valid_id_path, created_at"
      )
      .in("id", userIds);
    for (const u of usersData ?? []) {
      userMap.set(u.id as number, u);
    }
  }

  const rows = (data ?? []).map((r) => {
    const u = userMap.get(r.user_id as number);
    return {
      ...r,
      email: u ? resolveEmail(u.email_display, u.username) : resolveEmail(null, r.username),
      fullname: u ? formatFullName(u.firstname, u.lastname) : "—",
      firstname: u ? safeDecryptPii(u.firstname) : "",
      lastname: u ? safeDecryptPii(u.lastname) : "",
      age: u ? safeDecryptPii(u.age) : "",
      gender: u ? safeDecryptPii(u.gender) : "",
      phone_number: u ? safeDecryptPii(u.phone_number) : "",
      school: u ? safeDecryptPii(u.school) : "",
      city: u ? safeDecryptPii(u.city) : "",
      province: u ? safeDecryptPii(u.province) : "",
      education_level: u ? safeDecryptPii(u.education_level) : "",
      occupation: u ? safeDecryptPii(u.occupation) : "",
      is_government: Boolean(u?.is_government),
      office_phone: u ? safeDecryptPii(u.office_phone) : "",
      valid_id_path: u ? safeDecryptPii(u.valid_id_path) : "",
    };
  });
  return { rows };
}

export async function mutateAccountRequests(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (!id) throw new AdminMutationError("Request ID is required.");
  const note = String(payload.admin_note ?? payload.note ?? "").trim();
  const nowIso = new Date().toISOString();

  if (action === "delete") {
    const { data: reqRow } = await supabase
      .from("account_requests")
      .select("id, status, request_type")
      .eq("id", id)
      .single();
    if (!reqRow) throw new AdminMutationError("Request not found.", 404);
    if (session.role !== "admin" && String(reqRow.request_type) !== "renew") {
      throw new AdminMutationError("Librarians can only manage library card renewal requests.", 403);
    }
    if (reqRow.status === "pending") {
      throw new AdminMutationError("Cannot delete a pending request. Approve or reject first.");
    }
    const { error } = await supabase.from("account_requests").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id };
  }

  const { data: reqRow, error: fetchErr } = await supabase
    .from("account_requests")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .single();
  if (fetchErr || !reqRow) {
    throw new AdminMutationError("Pending request not found or already reviewed.", 404);
  }
  if (session.role !== "admin" && String(reqRow.request_type) !== "renew") {
    throw new AdminMutationError("Librarians can only manage library card renewal requests.", 403);
  }

  const author = await getStaffDisplayName(supabase, session.userId, session.role);

  if (action === "approve") {
    const targetUserId = reqRow.user_id as number;
    const reqType = String(reqRow.request_type);

    if (reqType === "register") {
      await supabase
        .from("users")
        .update({ is_active: true, is_approved: true })
        .eq("id", targetUserId);
    } else if (reqType === "deactivate") {
      await supabase
        .from("users")
        .update({ is_active: false, status: "offline", last_seen: nowIso })
        .eq("id", targetUserId);
    } else if (reqType === "delete") {
      await Promise.all([
        supabase.from("user_favorites").delete().eq("user_id", targetUserId),
        supabase.from("user_search_history").delete().eq("user_id", targetUserId),
        supabase.from("user_appearance").delete().eq("user_id", targetUserId),
        supabase.from("notification_reads").delete().eq("user_id", targetUserId),
      ]);
      await supabase.from("users").delete().eq("id", targetUserId);
    } else if (reqType === "renew" && reqRow.card_id) {
      await supabase
        .from("library_cards")
        .update({
          renewal1_checked: Boolean(reqRow.renewal1_checked),
          renewal1_date: reqRow.renewal1_date,
          renewal2_checked: Boolean(reqRow.renewal2_checked),
          renewal2_date: reqRow.renewal2_date,
        })
        .eq("id", reqRow.card_id);
    }

    await supabase
      .from("account_requests")
      .update({
        status: "approved",
        reviewed_by: session.userId,
        reviewed_at: nowIso,
        admin_note: note,
      })
      .eq("id", id);

    if (reqType !== "delete") {
      const title =
        reqType === "register"
          ? "Registration Approved — Welcome!"
          : reqType === "renew"
            ? "Library Card Renewal — Approved"
            : "Account Deactivation Request — Approved";
      const body =
        (reqType === "register"
          ? "Your registration has been approved by the Admin. You can now log in."
          : reqType === "renew"
            ? "Your library card renewal has been approved."
            : "Your deactivation request has been approved.") +
        (note ? ` Note: "${note}"` : "");

      await supabase.from("announcements").insert({
        title,
        body,
        category: "general",
        pinned: false,
        author,
        target_user_id: targetUserId,
      });
    }

    return { ok: true, status: "approved" };
  }

  if (action === "reject") {
    await supabase
      .from("account_requests")
      .update({
        status: "rejected",
        reviewed_by: session.userId,
        reviewed_at: nowIso,
        admin_note: note,
      })
      .eq("id", id);

    const reqType = String(reqRow.request_type);
    const label = reqType === "renew" ? "Renewal" : reqType.charAt(0).toUpperCase() + reqType.slice(1);
    await supabase.from("announcements").insert({
      title: `Account ${label} Request — Not Approved`,
      body:
        `Your ${reqType} request was not approved. ` +
        (note ? `Reason: "${note}"` : "Contact library staff for more information."),
      category: "urgent",
      pinned: false,
      author,
      target_user_id: reqRow.user_id,
    });

    return { ok: true, status: "rejected" };
  }

  throw new AdminMutationError(`Unknown account_requests action: ${action}`);
}
