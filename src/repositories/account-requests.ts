import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { STAFF_ROLES } from "@/config/constants";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import { sendRegistrationDecisionEmail } from "@/lib/email";
import {
  AdminMutationError,
  assertLibrarianRenewalOnly,
  formatFullName,
  getStaffDisplayName,
  resolveEmail,
} from "@/repositories/shared";
import { accountRequestReviewSchema } from "@/validators/admin";

export async function queryAccountRequests(
  supabase: SupabaseClient,
  sessionRole?: string | null
) {
  let query = supabase
    .from("account_requests")
    .select(
      "id, user_id, username, request_type, reason, status, admin_note, created_at, reviewed_at, card_id, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date"
    )
    .order("id", { ascending: false });
  if (sessionRole === "librarian") {
    query = query.eq("request_type", "renew");
  }
  const { data, error } = await query;
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
  await verifyRepositoryActor(supabase, session.userId, STAFF_ROLES);

  if (!id) throw new AdminMutationError("Request ID is required.", 400);

  const parsedReview = accountRequestReviewSchema.safeParse(payload);
  if (!parsedReview.success) {
    throw new AdminMutationError(
      parsedReview.error.issues[0]?.message || "Invalid account request review payload.",
      400
    );
  }
  const note = String(parsedReview.data.admin_note || parsedReview.data.note || "").trim();
  const nowIso = new Date().toISOString();

  if (action === "delete") {
    const { data: reqRow } = await supabase
      .from("account_requests")
      .select("id, user_id, status, request_type")
      .eq("id", id)
      .single();
    if (!reqRow) throw new AdminMutationError("Request not found.", 404);
    assertLibrarianRenewalOnly(session.role, String(reqRow.request_type));
    if (reqRow.status === "pending") {
      throw new AdminMutationError("Cannot delete a pending request. Approve or reject first.", 400);
    }
    const { error } = await supabase.from("account_requests").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      deletedId: id,
      target_user_id: Number(reqRow.user_id),
      audit_details: `action=delete_account_request id=${id} type=${String(reqRow.request_type)}`,
    };
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
  const targetUserId = Number(reqRow.user_id);
  const reqType = String(reqRow.request_type);
  assertLibrarianRenewalOnly(session.role, reqType);
  const author = await getStaffDisplayName(supabase, session.userId, session.role);

  // Fetch target user's email & firstname for registration decision email (matches admin_routes.py lines 1284 & 1339)
  let targetUserEmail = "";
  let targetUserFirstname = "";
  if (reqType === "register" && targetUserId) {
    const { data: targetUser } = await supabase
      .from("users")
      .select("username, email_display, firstname")
      .eq("id", targetUserId)
      .maybeSingle();
    if (targetUser) {
      targetUserEmail = resolveEmail(targetUser.email_display, targetUser.username);
      targetUserFirstname = safeDecryptPii(targetUser.firstname);
    }
    if (!targetUserEmail && reqRow.username) {
      targetUserEmail = resolveEmail(null, reqRow.username);
    }
  }

  if (action === "approve") {
    if (reqType === "register") {
      const { error } = await supabase
        .from("users")
        .update({ is_active: true, is_approved: true })
        .eq("id", targetUserId);
      if (error) throw new AdminMutationError(error.message, 500);
    } else if (reqType === "deactivate") {
      const { error } = await supabase
        .from("users")
        .update({ is_active: false, status: "offline", last_seen: nowIso })
        .eq("id", targetUserId);
      if (error) throw new AdminMutationError(error.message, 500);
    } else if (reqType === "delete") {
      const cleanupResults = await Promise.all([
        supabase.from("user_favorites").delete().eq("user_id", targetUserId),
        supabase.from("user_search_history").delete().eq("user_id", targetUserId),
        supabase.from("user_appearance").delete().eq("user_id", targetUserId),
        supabase.from("user_preferences").delete().eq("user_id", targetUserId),
        supabase.from("notification_reads").delete().eq("user_id", targetUserId),
      ]);
      const cleanupError = cleanupResults.find((result) => result.error)?.error;
      if (cleanupError) throw new AdminMutationError(cleanupError.message, 500);
      const { error } = await supabase.from("users").delete().eq("id", targetUserId);
      if (error) throw new AdminMutationError(error.message, 500);
    } else if (reqType === "renew" && reqRow.card_id) {
      const { error } = await supabase
        .from("library_cards")
        .update({
          renewal1_checked: Boolean(reqRow.renewal1_checked),
          renewal1_date: reqRow.renewal1_date,
          renewal2_checked: Boolean(reqRow.renewal2_checked),
          renewal2_date: reqRow.renewal2_date,
        })
        .eq("id", reqRow.card_id);
      if (error) throw new AdminMutationError(error.message, 500);
    }

    const { error: reviewError } = await supabase
      .from("account_requests")
      .update({
        status: "approved",
        reviewed_by: session.userId,
        reviewed_at: nowIso,
        admin_note: note,
      })
      .eq("id", id);
    if (reviewError) throw new AdminMutationError(reviewError.message, 500);

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

      const { error: announcementError } = await supabase.from("announcements").insert({
        title,
        body,
        category: "general",
        pinned: false,
        author,
        target_user_id: targetUserId,
      });
      if (announcementError) throw new AdminMutationError(announcementError.message, 500);

      if (reqType === "register" && targetUserEmail) {
        void sendRegistrationDecisionEmail({
          toEmail: targetUserEmail,
          firstname: targetUserFirstname,
          approved: true,
          note,
        });
      }
    }

    return {
      ok: true,
      status: "approved",
      target_user_id: targetUserId,
      audit_details: `action=approve_account_request id=${id} type=${reqType}`,
    };
  }

  if (action === "reject") {
    const { error: reviewError } = await supabase
      .from("account_requests")
      .update({
        status: "rejected",
        reviewed_by: session.userId,
        reviewed_at: nowIso,
        admin_note: note,
      })
      .eq("id", id);
    if (reviewError) throw new AdminMutationError(reviewError.message, 500);

    if (reqType === "register" && targetUserEmail) {
      void sendRegistrationDecisionEmail({
        toEmail: targetUserEmail,
        firstname: targetUserFirstname,
        approved: false,
        note,
      });
    }

    const label = reqType === "renew" ? "Renewal" : reqType.charAt(0).toUpperCase() + reqType.slice(1);
    const { error: announcementError } = await supabase.from("announcements").insert({
      title: `Account ${label} Request — Not Approved`,
      body:
        `Your ${reqType} request was not approved. ` +
        (note ? `Reason: "${note}"` : "Contact library staff for more information."),
      category: "urgent",
      pinned: false,
      author,
      target_user_id: targetUserId,
    });
    if (announcementError) throw new AdminMutationError(announcementError.message, 500);

    return {
      ok: true,
      status: "rejected",
      target_user_id: targetUserId,
      audit_details: `action=reject_account_request id=${id} type=${reqType}`,
    };
  }

  throw new AdminMutationError(`Unknown account_requests action: ${action}`, 400);
}
