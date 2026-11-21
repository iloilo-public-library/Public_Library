import type { SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { SessionPayload } from "@/lib/auth/session";
import { emailBlindIndex } from "@/lib/auth/session";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import {
  AdminMutationError,
  PW_ALLOWED_RE,
  PW_COMPLEXITY_RE,
  computeOnlineStatus,
  formatFullName,
  resolveEmail,
} from "@/repositories/shared";

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
  const defaultRole =
    resource === "admins" ? "admin" : resource === "librarians" ? "librarian" : "user";

  if (action === "create") {
    const firstname = String(payload.firstname ?? "").trim();
    const lastname = String(payload.lastname ?? "").trim();
    const email = String(payload.email ?? "").trim().toLowerCase();
    const password = String(payload.password ?? "");
    const role =
      payload.role === "admin" || payload.role === "librarian" || payload.role === "user"
        ? payload.role
        : defaultRole;

    if (firstname.length < 2 || lastname.length < 2 || !email.includes("@")) {
      throw new AdminMutationError("Valid first name, last name, and email are required.");
    }
    if (!PW_ALLOWED_RE.test(password) || !PW_COMPLEXITY_RE.test(password)) {
      throw new AdminMutationError(
        "Password must be 8-64 chars with uppercase, lowercase, number, and symbol (@$!%*?&_#^)."
      );
    }

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
    const gender = String(payload.gender ?? "").trim();
    const phone = String(payload.phone_number ?? payload.phone ?? "").trim();

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

    if (error || !created) throw new AdminMutationError(error?.message || "Failed to create account.", 500);
    return { ok: true, id: created.id };
  }

  if (!id) throw new AdminMutationError("User ID is required.");

  if (action === "delete") {
    if (id === session.userId) {
      throw new AdminMutationError("You cannot delete your own active admin account.");
    }
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id };
  }

  if (action === "unlock") {
    const { error } = await supabase
      .from("users")
      .update({ is_locked: false, failed_attempts: 0, lock_until: null })
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true };
  }

  if (action === "approve") {
    const { error } = await supabase
      .from("users")
      .update({ is_approved: true, is_active: true })
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true };
  }

  if (action === "toggle_active") {
    const nextActive = Boolean(payload.is_active);
    const updateData: Record<string, unknown> = { is_active: nextActive };
    if (!nextActive) {
      updateData.status = "offline";
      updateData.last_seen = new Date().toISOString();
    }
    const { error } = await supabase.from("users").update(updateData).eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, is_active: nextActive };
  }

  if (action === "reset_password") {
    const newPassword = String(payload.new_password ?? "");
    if (!PW_ALLOWED_RE.test(newPassword) || !PW_COMPLEXITY_RE.test(newPassword)) {
      throw new AdminMutationError(
        "New password must be 8-64 chars with uppercase, lowercase, number, and symbol (@$!%*?&_#^)."
      );
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    const { error } = await supabase
      .from("users")
      .update({
        password: hashed,
        failed_attempts: 0,
        is_locked: false,
        lock_until: null,
      })
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true };
  }

  throw new AdminMutationError(`Unknown account action: ${action}`);
}
