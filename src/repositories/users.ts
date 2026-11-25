import type { SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { SessionPayload } from "@/lib/auth/session";
import { emailBlindIndex } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import {
  AdminMutationError,
  computeOnlineStatus,
  formatFullName,
  resolveEmail,
} from "@/repositories/shared";
import {
  accountCreateSchema,
  accountResetPasswordSchema,
  accountToggleActiveSchema,
} from "@/validators/admin";

export async function queryAccountsByRole(
  supabase: SupabaseClient,
  resource: "users" | "librarians" | "admins"
) {
  const roleFilter =
    resource === "users" ? "user" : resource === "librarians" ? "librarian" : "admin";
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, username, email_display, firstname, lastname, age, gender, phone_number, school, city, province, education_level, occupation, is_government, office_phone, valid_id_path, role, status, is_active, is_approved, is_locked, failed_attempts, lock_until, last_seen, created_at"
    )
    .eq("role", roleFilter)
    .order("id", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []).map((u) => {
    const email = resolveEmail(u.email_display, u.username);
    const fn = safeDecryptPii(u.firstname);
    const ln = safeDecryptPii(u.lastname);
    return {
      ...u,
      email,
      firstname: fn,
      lastname: ln,
      fullname: formatFullName(u.firstname, u.lastname),
      age: safeDecryptPii(u.age),
      gender: safeDecryptPii(u.gender),
      phone_number: safeDecryptPii(u.phone_number),
      school: safeDecryptPii(u.school),
      city: safeDecryptPii(u.city),
      province: safeDecryptPii(u.province),
      education_level: safeDecryptPii(u.education_level),
      occupation: safeDecryptPii(u.occupation),
      office_phone: safeDecryptPii(u.office_phone),
      valid_id_path: safeDecryptPii(u.valid_id_path),
      status: computeOnlineStatus(u.status, u.last_seen),
    };
  });
  return { rows };
}

export async function mutateAccounts(
  supabase: SupabaseClient,
  session: SessionPayload,
  resource: string,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  await verifyRepositoryActor(supabase, session.userId, ["admin"]);

  const defaultRole =
    resource === "admins" ? "admin" : resource === "librarians" ? "librarian" : "user";

  if (action === "create") {
    const parsed = accountCreateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message || "Valid first name, last name, and email are required.",
        400
      );
    }

    const { firstname, lastname, email, password } = parsed.data;
    const role = parsed.data.role ?? defaultRole;

    const usernameKey = email;
    const lookupKeys = Array.from(
      new Set([email, emailBlindIndex(email)].filter((k): k is string => Boolean(k)))
    );
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .or(
        `username.in.(${lookupKeys.map((k) => `"${k.replace(/"/g, "")}"`).join(",")}),email_display.eq."${email.replace(/"/g, "")}"`
      )
      .limit(1);
    if (existing && existing.length > 0) {
      throw new AdminMutationError("An account with this email already exists.", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const gender = String(parsed.data.gender ?? "").trim();
    const phone = String(parsed.data.phone_number ?? parsed.data.phone ?? "").trim();

    const { data: created, error } = await supabase
      .from("users")
      .insert({
        username: usernameKey,
        email_display: email,
        firstname,
        lastname,
        password: hashedPassword,
        role,
        gender: gender || null,
        phone_number: phone || null,
        is_active: true,
        is_approved: true,
        status: "offline",
      })
      .select("id")
      .single();

    if (error || !created) {
      throw new AdminMutationError(error?.message || "Failed to create account.", 500);
    }
    return {
      ok: true,
      id: created.id,
      target_user_id: Number(created.id),
      audit_details: `action=create_account role=${role}`,
    };
  }

  if (!id) throw new AdminMutationError("User ID is required.", 400);

  if (action === "delete") {
    if (id === session.userId) {
      throw new AdminMutationError("You cannot delete your own active admin account.", 400);
    }
    const { data: targetUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!targetUser) {
      throw new AdminMutationError("User not found.", 404);
    }

    // Cascade cleanup matching legacy-flask/routes/admin_routes.py line 1261
    await Promise.all([
      supabase.from("user_favorites").delete().eq("user_id", id),
      supabase.from("user_search_history").delete().eq("user_id", id),
      supabase.from("user_appearance").delete().eq("user_id", id),
      supabase.from("user_preferences").delete().eq("user_id", id),
      supabase.from("notification_reads").delete().eq("user_id", id),
    ]);

    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      deletedId: id,
      target_user_id: id,
      audit_details: `action=delete_account user_id=${id}`,
    };
  }

  if (action === "unlock") {
    const { error } = await supabase
      .from("users")
      .update({ is_locked: false, failed_attempts: 0, lock_until: null })
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      target_user_id: id,
      audit_details: `action=unlock_user user_id=${id}`,
    };
  }

  if (action === "approve") {
    const { error } = await supabase
      .from("users")
      .update({ is_approved: true, is_active: true })
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      target_user_id: id,
      audit_details: `action=approve_user user_id=${id}`,
    };
  }

  if (action === "toggle_active" || action === "deactivate" || action === "reactivate") {
    let nextActive: boolean;
    if (action === "deactivate") {
      nextActive = false;
    } else if (action === "reactivate") {
      nextActive = true;
    } else {
      const parsed = accountToggleActiveSchema.safeParse(payload);
      if (!parsed.success) {
        throw new AdminMutationError(
          parsed.error.issues[0]?.message || "is_active boolean is required.",
          400
        );
      }
      nextActive = parsed.data.is_active;
    }

    const updateData: Record<string, unknown> = { is_active: nextActive };
    if (!nextActive) {
      updateData.status = "offline";
      updateData.last_seen = new Date().toISOString();
    }
    const { data: updated, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new AdminMutationError(error.message, 500);
    if (!updated) throw new AdminMutationError("User not found.", 404);
    return {
      ok: true,
      is_active: nextActive,
      target_user_id: id,
      audit_details: `action=${action} user_id=${id} is_active=${nextActive}`,
    };
  }

  if (action === "reset_password") {
    const parsed = accountResetPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AdminMutationError(
        parsed.error.issues[0]?.message ||
          "New password must be 8-64 chars with uppercase, lowercase, number, and symbol (@$!%*?&_#^).",
        400
      );
    }

    const hashed = await bcrypt.hash(parsed.data.new_password, 12);
    const { error } = await supabase
      .from("users")
      .update({
        password: hashed,
        failed_attempts: 0,
        is_locked: false,
        lock_until: null,
        reset_token: null,
        reset_token_expiry: null,
      })
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return {
      ok: true,
      target_user_id: id,
      audit_details: `action=reset_user_password user_id=${id}`,
    };
  }

  throw new AdminMutationError(`Unknown account action: ${action}`, 400);
}
