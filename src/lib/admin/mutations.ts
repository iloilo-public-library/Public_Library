import type { SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { SessionPayload } from "@/lib/auth/session";
import { emailBlindIndex } from "@/lib/auth/session";
import { safeDecryptData, safeDecryptPii } from "@/lib/crypto/fernet";

export class AdminMutationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const PW_ALLOWED_RE = /^[A-Za-z\d@$!%*?&_#^]{8,64}$/;
const PW_COMPLEXITY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#^]).{8,64}$/;

function requireAdminOnly(session: SessionPayload) {
  if (session.role !== "admin") {
    throw new AdminMutationError("Only Administrators can perform this action.", 403);
  }
}

async function getStaffDisplayName(
  supabase: SupabaseClient,
  userId: number,
  role: string
): Promise<string> {
  const { data } = await supabase
    .from("users")
    .select("firstname, lastname")
    .eq("id", userId)
    .single();
  const fn = data ? safeDecryptPii(data.firstname) : "";
  const ln = data ? safeDecryptPii(data.lastname) : "";
  const full =
    fn.startsWith("gAAAAAB") || ln.startsWith("gAAAAAB")
      ? ""
      : `${fn} ${ln}`.trim();
  const roleLabel = role === "admin" ? "Admin" : "Librarian";
  return (full ? `${full} (${roleLabel})` : `Library ${roleLabel}`).slice(0, 100);
}

export async function handleAdminMutation(
  supabase: SupabaseClient,
  session: SessionPayload,
  resource: string,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (resource) {
    case "account_requests":
      requireAdminOnly(session);
      return mutateAccountRequests(supabase, session, action, id, payload);

    case "users":
    case "librarians":
    case "admins":
      requireAdminOnly(session);
      return mutateAccounts(supabase, session, resource, action, id, payload);

    case "books":
      return mutateBooks(supabase, action, id, payload);

    case "inventory":
      return mutateInventory(supabase, id, payload);

    case "library_cards":
      return mutateLibraryCards(supabase, session, action, id, payload);

    case "returns":
      return mutateReturns(supabase, session, action, id, payload);

    case "events":
      return mutateEvents(supabase, action, id, payload);

    case "announcements":
      return mutateAnnouncements(supabase, session, action, id, payload);

    case "system_settings":
      requireAdminOnly(session);
      return mutateSystemSettings(supabase, action, payload);

    case "admin_profile":
      return mutateAdminProfile(supabase, session, action, payload);

    default:
      throw new AdminMutationError(`Unsupported resource: ${resource}`, 400);
  }
}

async function mutateAccountRequests(
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
      .select("id, status")
      .eq("id", id)
      .single();
    if (!reqRow) throw new AdminMutationError("Request not found.", 404);
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

async function mutateAccounts(
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

async function mutateBooks(
  supabase: SupabaseClient,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (action === "delete") {
    if (!id) throw new AdminMutationError("Book ID is required.");
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id };
  }

  const title = String(payload.title ?? "").trim();
  const author = String(payload.author ?? "").trim();
  const isbn = String(payload.isbn ?? "").trim();
  if (!title || !author || !isbn) {
    throw new AdminMutationError("Title, Author, and ISBN are required.");
  }

  const category = String(payload.category ?? "").trim();
  const genreClass = String(payload.class ?? "").trim();
  const publisher = String(payload.publisher ?? "").trim();
  const volumes = Math.max(0, Number(payload.volumes ?? 1) || 0);
  const damaged = Math.max(0, Number(payload.damaged_copies ?? 0) || 0);
  const lost = Math.max(0, Number(payload.lost_copies ?? 0) || 0);
  const available = Math.max(0, volumes - damaged - lost);
  const shelfLocation = String(payload.shelf_location ?? "").trim() || null;
  const invStatus = String(payload.inventory_status ?? "Available").trim() || "Available";

  const bookData: Record<string, unknown> = {
    title,
    author,
    isbn,
    call_number: String(payload.call_number ?? "").trim() || null,
    class: genreClass || null,
    category: category || null,
    publisher: publisher || null,
    edition: String(payload.edition ?? "").trim() || null,
    published_date: String(payload.published_date ?? "").trim() || null,
    subtitle: String(payload.subtitle ?? "").trim() || null,
    description: String(payload.description ?? "").trim() || null,
    language: String(payload.language ?? "en").trim().slice(0, 5) || "en",
    thumbnail_url: String(payload.thumbnail_url ?? "").trim() || null,
    api_source: String(payload.api_source ?? "Manual").trim() || "Manual",
    source_of_fund: String(payload.source_of_fund ?? "").trim() || null,
    copy_right: String(payload.copy_right ?? "").trim() || null,
    cost_price: payload.cost_price ? Number(payload.cost_price) : null,
    page_count: payload.page_count ? Math.max(0, Number(payload.page_count)) : null,
    date_received: String(payload.date_received ?? "").trim() || null,
    is_borrowable: payload.is_borrowable !== false && payload.is_borrowable !== "false",
  };

  if (action === "create") {
    const { data: inserted, error } = await supabase
      .from("books")
      .insert(bookData)
      .select("id")
      .single();
    if (error || !inserted) {
      throw new AdminMutationError(error?.message || "Failed to add book.", 500);
    }
    await supabase.from("book_inventory").insert({
      book_id: inserted.id,
      volumes,
      available_copies: available,
      damaged_copies: damaged,
      lost_copies: lost,
      shelf_location: shelfLocation,
      status: invStatus,
    });
    return { ok: true, id: inserted.id };
  }

  if (action === "update") {
    if (!id) throw new AdminMutationError("Book ID is required.");
    const { error } = await supabase.from("books").update(bookData).eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);

    const { data: existingInv } = await supabase
      .from("book_inventory")
      .select("id")
      .eq("book_id", id)
      .limit(1);

    if (existingInv && existingInv.length > 0) {
      await supabase
        .from("book_inventory")
        .update({
          volumes,
          available_copies: available,
          damaged_copies: damaged,
          lost_copies: lost,
          shelf_location: shelfLocation,
          status: invStatus,
        })
        .eq("book_id", id);
    } else {
      await supabase.from("book_inventory").insert({
        book_id: id,
        volumes,
        available_copies: available,
        damaged_copies: damaged,
        lost_copies: lost,
        shelf_location: shelfLocation,
        status: invStatus,
      });
    }
    return { ok: true, id };
  }

  throw new AdminMutationError(`Unknown books action: ${action}`);
}

async function mutateInventory(
  supabase: SupabaseClient,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (!id) throw new AdminMutationError("Inventory ID is required.");

  const volumes = Math.max(0, Number(payload.volumes ?? 0) || 0);
  const availableCopies = Math.max(0, Number(payload.available_copies ?? 0) || 0);
  const damagedCopies = Math.max(0, Number(payload.damaged_copies ?? 0) || 0);
  const lostCopies = Math.max(0, Number(payload.lost_copies ?? 0) || 0);
  const shelfLocation = String(payload.shelf_location ?? "").trim() || null;
  const status = String(payload.status ?? "Available").trim() || "Available";

  const { data: updatedInv, error } = await supabase
    .from("book_inventory")
    .update({
      volumes,
      available_copies: Math.min(volumes, availableCopies),
      damaged_copies: damagedCopies,
      lost_copies: lostCopies,
      shelf_location: shelfLocation,
      status,
    })
    .eq("id", id)
    .select("book_id")
    .single();

  if (error) throw new AdminMutationError(error.message, 500);

  if (updatedInv?.book_id && payload.is_borrowable !== undefined) {
    await supabase
      .from("books")
      .update({ is_borrowable: Boolean(payload.is_borrowable) })
      .eq("id", updatedInv.book_id);
  }

  return { ok: true, id };
}

async function mutateLibraryCards(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (action === "delete") {
    if (!id) throw new AdminMutationError("Card ID is required.");
    const { error } = await supabase.from("library_cards").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id };
  }

  if (action === "create") {
    const firstname = String(payload.firstname ?? "").trim();
    const lastname = String(payload.lastname ?? "").trim();
    if (!firstname || !lastname) {
      throw new AdminMutationError("First name and last name are required.");
    }
    const category = payload.card_type_category === "member" ? "member" : "borrower";
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateIssued = String(payload.date_issued ?? "").trim() || todayStr;
    const dateReturn = String(payload.date_return ?? "").trim() || null;
    const bookId = payload.book_id ? Number(payload.book_id) : null;
    const quantity = Math.max(1, Number(payload.quantity ?? 1) || 1);

    const { data: card, error } = await supabase
      .from("library_cards")
      .insert({
        card_type_category: category,
        user_id: payload.user_id ? Number(payload.user_id) : null,
        firstname,
        lastname,
        phone_number: payload.phone_number ? String(payload.phone_number).trim() : null,
        address: payload.address ? String(payload.address).trim() : null,
        date_issued: dateIssued,
        date_return: dateReturn,
        card_type: String(payload.card_type ?? "regular").trim() || "regular",
        valid_until: String(payload.valid_until ?? "").trim() || null,
        registered_by: session.userId,
      })
      .select("id")
      .single();

    if (error || !card) throw new AdminMutationError(error?.message || "Failed to issue card.", 500);

    if (bookId) {
      const { data: book } = await supabase
        .from("books")
        .select("id, title, author, isbn")
        .eq("id", bookId)
        .single();
      if (book) {
        await supabase.from("library_card_books").insert({
          card_id: card.id,
          book_id: book.id,
          book_title: safeDecryptData(book.title),
          book_author: safeDecryptData(book.author),
          book_isbn: safeDecryptData(book.isbn),
          quantity,
        });
        const { data: inv } = await supabase
          .from("book_inventory")
          .select("id, available_copies")
          .eq("book_id", book.id)
          .single();
        if (inv) {
          await supabase
            .from("book_inventory")
            .update({ available_copies: Math.max(0, inv.available_copies - quantity) })
            .eq("id", inv.id);
        }
      }
    }

    return { ok: true, id: card.id };
  }

  if (action === "return_books") {
    if (!id) throw new AdminMutationError("Card ID is required.");
    const returnDate =
      String(payload.return_date ?? "").trim() || new Date().toISOString().slice(0, 10);

    const { data: cardBooks } = await supabase
      .from("library_card_books")
      .select("*")
      .eq("card_id", id);

    if (!cardBooks || cardBooks.length === 0) {
      throw new AdminMutationError("No borrowed books recorded on this card.");
    }

    const { data: retRow, error } = await supabase
      .from("book_returns")
      .insert({
        card_id: id,
        return_date: returnDate,
        processed_by: session.userId,
      })
      .select("id")
      .single();

    if (error || !retRow) throw new AdminMutationError(error?.message || "Failed to log return.", 500);

    for (const cb of cardBooks) {
      await supabase.from("book_return_items").insert({
        return_id: retRow.id,
        card_book_id: cb.id,
        book_title: cb.book_title,
        book_author: cb.book_author,
        book_isbn: cb.book_isbn,
        qty_returned: cb.quantity ?? 1,
      });

      if (cb.book_id) {
        const { data: inv } = await supabase
          .from("book_inventory")
          .select("id, volumes, available_copies")
          .eq("book_id", cb.book_id)
          .single();
        if (inv) {
          await supabase
            .from("book_inventory")
            .update({
              available_copies: Math.min(
                inv.volumes,
                inv.available_copies + (cb.quantity ?? 1)
              ),
            })
            .eq("id", inv.id);
        }
      }
    }
    return { ok: true, returnId: retRow.id };
  }

  if (action === "renew" || action === "update") {
    if (!id) throw new AdminMutationError("Card ID is required.");
    const { error } = await supabase
      .from("library_cards")
      .update({
        date_return: String(payload.date_return ?? "").trim() || null,
        valid_until: String(payload.valid_until ?? "").trim() || null,
        renewal1_checked: Boolean(payload.renewal1_checked),
        renewal1_date: String(payload.renewal1_date ?? "").trim() || null,
        renewal2_checked: Boolean(payload.renewal2_checked),
        renewal2_date: String(payload.renewal2_date ?? "").trim() || null,
      })
      .eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, id };
  }

  throw new AdminMutationError(`Unknown library_cards action: ${action}`);
}

async function mutateReturns(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  id: number | null,
  payload: Record<string, unknown>
) {
  if (action === "delete") {
    if (!id) throw new AdminMutationError("Return item ID is required.");
    const { error } = await supabase.from("book_return_items").delete().eq("id", id);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, deletedId: id };
  }

  if (action === "create") {
    const cardId = Number(payload.card_id);
    if (!cardId) throw new AdminMutationError("A valid Library Card ID is required.");
    return mutateLibraryCards(supabase, session, "return_books", cardId, payload);
  }

  throw new AdminMutationError(`Unknown returns action: ${action}`);
}

async function mutateEvents(
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

async function mutateAnnouncements(
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

async function mutateSystemSettings(
  supabase: SupabaseClient,
  action: string,
  payload: Record<string, unknown>
) {
  if (action === "run_backup") {
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const fileName = `supabase_snapshot_${stamp}.json`;
    const scope = String(payload.scope ?? "Database Snapshot").trim() || "Database Snapshot";
    const { data, error } = await supabase
      .from("backup_logs")
      .insert({
        backup_type: "manual",
        scope,
        file_name: fileName,
        file_size_bytes: 0,
        dropbox_path: `/Supabase_Exports/${fileName}`,
        status: "success",
        error_message: "",
      })
      .select("*")
      .single();
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true, log: data };
  }

  const validFreqs = new Set(["hourly", "daily", "weekly", "monthly", "off"]);
  const backupFrequency = validFreqs.has(String(payload.backup_frequency))
    ? String(payload.backup_frequency)
    : "weekly";
  const bypassRole =
    payload.bypass_role === "admin_librarian" ? "admin_librarian" : "admin";

  const { error } = await supabase.from("system_settings").upsert({
    id: 1,
    maintenance_enabled: Boolean(payload.maintenance_enabled),
    maintenance_message:
      String(payload.maintenance_message ?? "").trim() ||
      "The library system is currently under scheduled maintenance. We'll be back shortly.",
    bypass_role: bypassRole,
    lockdown_enabled: Boolean(payload.lockdown_enabled),
    backup_frequency: backupFrequency,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new AdminMutationError(error.message, 500);
  return { ok: true };
}

async function mutateAdminProfile(
  supabase: SupabaseClient,
  session: SessionPayload,
  action: string,
  payload: Record<string, unknown>
) {
  if (action === "update_profile") {
    const firstname = String(payload.firstname ?? "").trim();
    const lastname = String(payload.lastname ?? "").trim();
    const gender = String(payload.gender ?? "").trim();
    const phone = String(payload.phone_number ?? "").trim();

    if (firstname.length < 2 || lastname.length < 2) {
      throw new AdminMutationError("First name and last name must each be at least 2 characters.");
    }

    const { error } = await supabase
      .from("users")
      .update({
        firstname,
        lastname,
        gender: gender || null,
        phone_number: phone || null,
      })
      .eq("id", session.userId);

    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true };
  }

  if (action === "change_password") {
    const current = String(payload.current_password ?? "");
    const nextPw = String(payload.new_password ?? "");
    const confirm = String(payload.confirm_password ?? "");
    if (!current || !nextPw || !confirm) {
      throw new AdminMutationError("All password fields are required.");
    }
    if (nextPw !== confirm) {
      throw new AdminMutationError("New password and confirmation do not match.");
    }
    if (!PW_ALLOWED_RE.test(nextPw) || !PW_COMPLEXITY_RE.test(nextPw)) {
      throw new AdminMutationError(
        "New password must be 8-64 chars with uppercase, lowercase, number, and symbol (@$!%*?&_#^)."
      );
    }

    const { data: user } = await supabase
      .from("users")
      .select("password")
      .eq("id", session.userId)
      .single();

    if (!user || !(await bcrypt.compare(current, user.password as string))) {
      throw new AdminMutationError("Current password is incorrect.", 403);
    }

    const hashed = await bcrypt.hash(nextPw, 12);
    const { error } = await supabase
      .from("users")
      .update({
        password: hashed,
        failed_attempts: 0,
        is_locked: false,
        lock_until: null,
      })
      .eq("id", session.userId);

    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true };
  }

  if (action === "toggle_security") {
    const method = payload.method === "otp" ? "otp_enabled" : payload.method === "pin" ? "pin_enabled" : null;
    if (!method) throw new AdminMutationError("Invalid security method.");
    const { error } = await supabase
      .from("users")
      .update({ [method]: Boolean(payload.enabled) })
      .eq("id", session.userId);
    if (error) throw new AdminMutationError(error.message, 500);
    return { ok: true };
  }

  throw new AdminMutationError(`Unknown admin_profile action: ${action}`);
}
