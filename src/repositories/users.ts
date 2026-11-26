import type { SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { SessionPayload } from "@/lib/auth/session";
import { emailBlindIndex } from "@/lib/auth/session";
import { verifyRepositoryActor } from "@/lib/auth/rbac";
import { safeDecryptPii } from "@/lib/crypto/fernet";
import {
  AdminMutationError,
  assertNotOwnAccount,
  computeOnlineStatus,
  formatFullName,
  resolveEmail,
} from "@/repositories/shared";
import {
  accountCreateSchema,
  accountResetPasswordSchema,
  accountToggleActiveSchema,
} from "@/validators/admin";
import type { AdminUsersQueryInput } from "@/validators/admin";

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

function formatAdminUserRow(
  user: Record<string, unknown>,
  isAdmin: boolean
): Record<string, unknown> {
  const firstname = safeDecryptPii(user.firstname);
  const lastname = safeDecryptPii(user.lastname);
  const city = safeDecryptPii(user.city);
  const province = safeDecryptPii(user.province);
  const email = resolveEmail(user.email_display, user.username);
  const validIdPath = safeDecryptPii(user.valid_id_path);

  return {
    id: user.id,
    email,
    username: email,
    firstname,
    lastname,
    fullname: formatFullName(user.firstname, user.lastname),
    age: safeDecryptPii(user.age),
    gender: safeDecryptPii(user.gender),
    phone_number: safeDecryptPii(user.phone_number),
    school: safeDecryptPii(user.school),
    city,
    province,
    address: [city, province].filter(Boolean).join(", "),
    education_level: safeDecryptPii(user.education_level),
    occupation: safeDecryptPii(user.occupation),
    is_government: Boolean(user.is_government),
    office_phone: safeDecryptPii(user.office_phone),
    role: user.role,
    status: computeOnlineStatus(user.status, user.last_seen),
    is_active: user.is_active !== undefined ? Boolean(user.is_active) : true,
    is_approved: Boolean(user.is_approved),
    is_locked: Boolean(user.is_locked),
    failed_attempts: Number(user.failed_attempts ?? 0),
    lock_until: user.lock_until ?? null,
    otp_enabled: Boolean(user.otp_enabled),
    pin_enabled: Boolean(user.pin_enabled),
    valid_id_url: isAdmin && validIdPath ? `/api/admin/valid-id/${user.id}` : "",
    created_at: user.created_at,
    last_seen: user.last_seen,
  };
}

function matchesAdminUserSearch(
  user: Record<string, unknown>,
  query: string
): boolean {
  if (!query) return true;
  const queryLower = query.toLowerCase();
  const firstname = safeDecryptPii(user.firstname).toLowerCase();
  const lastname = safeDecryptPii(user.lastname).toLowerCase();
  const fullname = `${firstname} ${lastname}`.trim();
  const email = resolveEmail(user.email_display, user.username).toLowerCase();
  const phone = safeDecryptPii(user.phone_number).toLowerCase();
  return (
    firstname.includes(queryLower) ||
    lastname.includes(queryLower) ||
    fullname.includes(queryLower) ||
    email.includes(queryLower) ||
    phone.includes(queryLower)
  );
}

export async function queryAdminUsers(
  supabase: SupabaseClient,
  session: SessionPayload,
  input: AdminUsersQueryInput
) {
  await verifyRepositoryActor(
    supabase,
    session.userId,
    ["admin", "librarian"]
  );

  const isAdmin = session.role === "admin";
  const selectColumns =
    "id, username, email_display, firstname, lastname, age, gender, phone_number, school, city, province, education_level, occupation, is_government, office_phone, valid_id_path, role, status, is_active, is_approved, is_locked, failed_attempts, lock_until, otp_enabled, pin_enabled, created_at, last_seen";

  if (input.id) {
    const { data: user, error } = await supabase
      .from("users")
      .select(selectColumns)
      .eq("id", input.id)
      .single();
    if (error || !user) {
      throw new AdminMutationError("User not found.", 404);
    }
    if (session.role === "librarian" && user.role !== "user") {
      throw new AdminMutationError(
        "Librarians can only inspect patron accounts.",
        403
      );
    }
    return { ok: true as const, user: formatAdminUserRow(user, isAdmin) };
  }

  const isPickerMode = input.mode === "picker" || input.role === "member";
  const effectiveLimit = isPickerMode
    ? Math.min(input.limit ?? 8, 25)
    : (input.limit ?? 25);
  const queryText = input.q.trim();

  if (isPickerMode) {
    let pickerQuery = supabase
      .from("users")
      .select(
        "id, username, email_display, firstname, lastname, phone_number, is_active, is_approved"
      )
      .eq("role", "user")
      .eq("is_active", true)
      .eq("is_approved", true)
      .order("id", { ascending: false });

    if (queryText) {
      const safeQuery = queryText.replace(/[%_,()"]/g, "");
      const blindEmail = emailBlindIndex(queryText);
      if (safeQuery) {
        const clauses = [
          `firstname.ilike.%${safeQuery}%`,
          `lastname.ilike.%${safeQuery}%`,
          `email_display.ilike.%${safeQuery}%`,
        ];
        if (blindEmail) clauses.push(`username.eq.${blindEmail}`);
        pickerQuery = pickerQuery.or(clauses.join(","));
      }
    }

    let { data: memberRows, error } = await pickerQuery.limit(effectiveLimit);
    if (error) throw error;

    if (queryText && (!memberRows || memberRows.length === 0)) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("users")
        .select(
          "id, username, email_display, firstname, lastname, phone_number, is_active, is_approved"
        )
        .eq("role", "user")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("id", { ascending: false })
        .limit(200);
      if (fallbackError) throw fallbackError;
      memberRows = (fallbackRows ?? [])
        .filter((row) =>
          matchesAdminUserSearch(row, queryText.toLowerCase())
        )
        .slice(0, effectiveLimit);
    }

    const rows = memberRows ?? [];
    const memberIds = rows.map((row) => Number(row.id));
    const cardMap = new Map<number, string>();
    if (memberIds.length > 0) {
      const { data: cardRows, error: cardError } = await supabase
        .from("library_cards")
        .select("id, user_id")
        .in("user_id", memberIds)
        .order("id", { ascending: false });
      if (cardError) throw cardError;
      for (const card of cardRows ?? []) {
        const userId = Number(card.user_id);
        if (!cardMap.has(userId)) {
          cardMap.set(userId, `LC-${String(card.id).padStart(6, "0")}`);
        }
      }
    }

    const users = rows.map((row) => ({
      id: Number(row.id),
      firstname: safeDecryptPii(row.firstname),
      lastname: safeDecryptPii(row.lastname),
      fullname: formatFullName(row.firstname, row.lastname),
      is_active: Boolean(row.is_active),
      is_approved: Boolean(row.is_approved),
      library_card_number: cardMap.get(Number(row.id)) ?? null,
    }));
    return { ok: true as const, users, count: users.length };
  }

  const effectiveRole = session.role === "librarian" ? "user" : input.role;
  let userQuery = supabase
    .from("users")
    .select(selectColumns)
    .order("id", { ascending: false });
  if (effectiveRole !== "all") {
    userQuery = userQuery.eq("role", effectiveRole);
  }

  if (queryText) {
    const safeQuery = queryText.replace(/[%_,()"]/g, "");
    const blindEmail = emailBlindIndex(queryText);
    if (safeQuery) {
      const clauses = [
        `firstname.ilike.%${safeQuery}%`,
        `lastname.ilike.%${safeQuery}%`,
        `email_display.ilike.%${safeQuery}%`,
        `username.ilike.%${safeQuery}%`,
        `phone_number.ilike.%${safeQuery}%`,
      ];
      if (blindEmail) clauses.push(`username.eq.${blindEmail}`);
      userQuery = userQuery.or(clauses.join(","));
    }
  }

  let { data, error } = await userQuery.limit(effectiveLimit);
  if (error) throw error;

  if (queryText && (!data || data.length === 0)) {
    let fallbackQuery = supabase
      .from("users")
      .select(selectColumns)
      .order("id", { ascending: false });
    if (effectiveRole !== "all") {
      fallbackQuery = fallbackQuery.eq("role", effectiveRole);
    }
    const { data: fallbackRows, error: fallbackError } =
      await fallbackQuery.limit(200);
    if (fallbackError) throw fallbackError;
    data = (fallbackRows ?? [])
      .filter((row) =>
        matchesAdminUserSearch(row, queryText.toLowerCase())
      )
      .slice(0, effectiveLimit);
  }

  const users = (data ?? []).map((row) =>
    formatAdminUserRow(row, isAdmin)
  );
  return { ok: true as const, users, count: users.length };
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
    if (role !== defaultRole) {
      throw new AdminMutationError(
        `Role must match the ${defaultRole} management resource.`,
        400
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

  const { data: targetUser, error: targetError } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();
  if (targetError) throw new AdminMutationError(targetError.message, 500);
  if (!targetUser) throw new AdminMutationError("User not found.", 404);
  if (String(targetUser.role) !== defaultRole) {
    throw new AdminMutationError(
      `Target account is not managed by the ${defaultRole} resource.`,
      400
    );
  }

  if (action === "delete") {
    assertNotOwnAccount(session.userId, id, "delete");
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
    if ((action === "toggle_active" || action === "deactivate") && id === session.userId) {
      const parsedActive =
        action === "toggle_active"
          ? accountToggleActiveSchema.safeParse(payload)
          : null;
      if (
        action === "deactivate" ||
        (parsedActive?.success && parsedActive.data.is_active === false)
      ) {
        assertNotOwnAccount(session.userId, id, "deactivate");
      }
    }
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
