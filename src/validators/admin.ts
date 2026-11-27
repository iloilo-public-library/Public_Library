import { z } from "zod";
import { validateOptionalIsbn } from "@/lib/books/isbn";
import { nullableIdSchema } from "@/validators/common";

export const ADMIN_RESOURCES = [
  "inventory",
  "books",
  "library_cards",
  "returns",
  "users",
  "librarians",
  "admins",
  "account_requests",
  "events",
  "event_categories",
  "announcements",
  "system_settings",
  "backup_logs",
  "admin_profile",
  "isbn_lookup",
  "error_logs",
] as const;

export const adminResourceSchema = z.enum(ADMIN_RESOURCES);
export type AdminResource = z.infer<typeof adminResourceSchema>;

export const adminQuerySchema = z
  .object({
    resource: adminResourceSchema,
    id: z.coerce.number().int().positive().optional(),
    isbn: z.string().trim().max(64).optional(),
    from: z.string().trim().max(32).optional(),
    to: z.string().trim().max(32).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    pageSize: z.coerce.number().int().min(1).max(200).optional(),
    q: z.string().trim().max(120).optional(),
    status: z.string().trim().max(40).optional(),
    category: z.string().trim().max(120).optional(),
    condition: z.string().trim().max(40).optional(),
    available: z.enum(["true", "false", "1", "0"]).optional(),
    damaged: z.enum(["true", "false", "1", "0"]).optional(),
    overdue: z.enum(["true", "false", "1", "0"]).optional(),
    format: z.enum(["json", "csv"]).optional(),
    sort: z.string().trim().max(64).optional(),
    order: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

export const adminMutationSchema = z
  .object({
    resource: adminResourceSchema,
    action: z.string().trim().min(1).max(64).optional(),
    id: nullableIdSchema,
    payload: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .strict();

export type AdminQueryInput = z.infer<typeof adminQuerySchema>;
export type AdminMutationInput = z.infer<typeof adminMutationSchema>;

export const staffAppearanceSchema = z
  .object({
    theme: z.enum(["default", "dark", "light", "ocean"]).default("default"),
    language: z.enum(["english", "filipino", "hiligaynon"]).default("english"),
  })
  .strict();

const NAME_RE = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'\-]{1,63}$/;
const PHONE_RE = /^\+?[0-9][0-9 \-()]{5,18}[0-9]$/;

export const adminUpdateProfileSchema = z
  .object({
    firstname: z
      .string()
      .trim()
      .transform((s) => s.replace(/\s+/g, " "))
      .refine((s) => s.length >= 2 && s.length <= 64, "First name must be 2 to 64 characters.")
      .refine(
        (s) => NAME_RE.test(s),
        "Enter a valid first name (letters, spaces, . ' - only, max 64)."
      )
      .optional(),
    lastname: z
      .string()
      .trim()
      .transform((s) => s.replace(/\s+/g, " "))
      .refine((s) => s.length >= 2 && s.length <= 64, "Last name must be 2 to 64 characters.")
      .refine(
        (s) => NAME_RE.test(s),
        "Enter a valid last name (letters, spaces, . ' - only, max 64)."
      )
      .optional(),
    gender: z.enum(["Male", "Female", "Others", ""]).optional(),
    phone_number: z
      .string()
      .trim()
      .max(20, "Phone number must be 20 characters or fewer.")
      .refine((v) => {
        if (v === "") return true;
        const digits = v.replace(/\D/g, "");
        return PHONE_RE.test(v) && digits.length >= 7 && digits.length <= 15;
      }, "Enter a valid phone number (7–15 digits).")
      .optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.firstname !== undefined ||
      d.lastname !== undefined ||
      d.gender !== undefined ||
      d.phone_number !== undefined,
    { message: "At least one profile field is required." }
  );

export const adminChangePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required.").max(128),
    new_password: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(64, "New password must be 64 characters or fewer.")
      .regex(
        /^[A-Za-z\d@$!%*?&_#^]{8,64}$/,
        "Only letters, numbers, and @$!%*?&_#^ are allowed."
      )
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#^]).{8,64}$/,
        "New password must include uppercase, lowercase, number, and symbol (@$!%*?&_#^)."
      ),
    confirm_password: z.string().min(1, "Confirm password is required.").max(64),
  })
  .strict()
  .refine((d) => d.new_password === d.confirm_password, {
    message: "New password and confirmation do not match.",
    path: ["confirm_password"],
  });

export const adminToggleSecuritySchema = z
  .object({
    method: z.enum(["otp", "pin"]),
    enabled: z.boolean(),
  })
  .strict();

export const adminSetPinSchema = z
  .object({
    password: z.string().min(1, "Current password is required.").max(128),
    pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits."),
    confirm: z.string().regex(/^\d{6}$/, "PIN confirmation must be exactly 6 digits."),
  })
  .strict()
  .refine((d) => d.pin === d.confirm, {
    message: "PIN and confirmation do not match.",
    path: ["confirm"],
  });

export const adminUsersQuerySchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    q: z.string().trim().max(120).optional().default(""),
    role: z.enum(["all", "user", "member", "librarian", "admin"]).optional().default("all"),
    mode: z.enum(["full", "picker"]).optional().default("full"),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type AdminUsersQueryInput = z.infer<typeof adminUsersQuerySchema>;

const optionalRecipientIdSchema = z
  .union([
    z.number().int().positive("Recipient ID must be a positive integer."),
    z
      .string()
      .trim()
      .regex(/^\d+$/, "Recipient ID must be a positive integer.")
      .transform((v) => Number(v))
      .refine((n) => Number.isSafeInteger(n) && n > 0, "Recipient ID must be a positive integer."),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((val) => (val === null || val === undefined || val === "" ? null : val));

export const announcementCreateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Announcement title is required.")
      .max(120, "Announcement title must be 120 characters or fewer."),
    body: z
      .string()
      .trim()
      .min(1, "Announcement message body is required.")
      .max(1000, "Announcement message must be 1000 characters or fewer."),
    category: z.enum(["general", "urgent", "event", "reminder"]).optional().default("general"),
    pinned: z.boolean().optional().default(false),
    target_user_id: optionalRecipientIdSchema,
  })
  .strict();

export const announcementUpdateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Announcement title is required.")
      .max(120, "Announcement title must be 120 characters or fewer."),
    body: z
      .string()
      .trim()
      .min(1, "Announcement message body is required.")
      .max(1000, "Announcement message must be 1000 characters or fewer."),
    category: z.enum(["general", "urgent", "event", "reminder"]).optional().default("general"),
    pinned: z.boolean().optional().default(false),
  })
  .strict();

export const announcementTogglePinSchema = z
  .object({
    pinned: z.boolean(),
  })
  .strict();

const nullableOptStr = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v === null || v === undefined ? "" : String(v).trim()));

export const BOOK_COPY_CONDITIONS = [
  "Good",
  "Fair",
  "Damaged",
  "Destroyed",
  "Lost",
  "Under Repair",
] as const;

export const BOOK_COPY_CIRCULATION_STATUSES = [
  "Available",
  "Borrowed",
  "Reserved",
  "Unusable",
] as const;

export const bookCopyInputSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    book_id: z.coerce.number().int().positive().optional(),
    copy_number: z.coerce.number().int().min(1).max(5000).optional(),
    accession_number: nullableOptStr.optional(),
    condition: z.enum(BOOK_COPY_CONDITIONS).optional().default("Good"),
    circulation_status: z.enum(BOOK_COPY_CIRCULATION_STATUSES).optional().default("Available"),
    condition_notes: nullableOptStr.optional(),
    shelf_location: nullableOptStr.optional(),
  })
  .strict();

export const bookDeletePayloadSchema = z.object({}).strict();

const optionalValidatedIsbnSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .superRefine((val, ctx) => {
    const check = validateOptionalIsbn(val);
    if (!check.ok) {
      ctx.addIssue({ code: "custom", message: check.error });
    }
  })
  .transform((val) => {
    const check = validateOptionalIsbn(val);
    return check.ok ? check.normalized : null;
  });

export const bookMutationPayloadSchema = z
  .object({
    title: z.string().trim().min(1, "Title and Author are required.").max(1000),
    author: z.string().trim().min(1, "Title and Author are required.").max(1000),
    isbn: optionalValidatedIsbnSchema,
    call_number: nullableOptStr.optional(),
    catalog_code: nullableOptStr.optional(),
    accession_prefix: nullableOptStr.optional(),
    category: nullableOptStr.optional(),
    class: nullableOptStr.optional(),
    genre: nullableOptStr.optional(),
    publisher: nullableOptStr.optional(),
    edition: nullableOptStr.optional(),
    published_date: nullableOptStr.optional(),
    subtitle: nullableOptStr.optional(),
    description: nullableOptStr.optional(),
    language: nullableOptStr.optional(),
    thumbnail_url: nullableOptStr.optional(),
    api_source: nullableOptStr.optional(),
    source_of_fund: nullableOptStr.optional(),
    copy_right: nullableOptStr.optional(),
    cost_price: z.union([z.number(), z.string(), z.null(), z.undefined()]).optional(),
    page_count: z.union([z.number(), z.string(), z.null(), z.undefined()]).optional(),
    date_received: nullableOptStr.optional(),
    is_borrowable: z.union([z.boolean(), z.string(), z.number()]).optional(),
    copies_to_add: z.coerce.number().int().min(0).max(5000).optional(),
    total_copies: z.coerce.number().int().min(0).max(5000).optional(),
    volumes: z.coerce.number().int().min(0).max(5000).optional(),
    available_copies: z.coerce.number().int().min(0).max(5000).optional(),
    borrowed_copies: z.coerce.number().int().min(0).max(5000).optional(),
    damaged_copies: z.coerce.number().int().min(0).max(5000).optional(),
    destroyed_copies: z.coerce.number().int().min(0).max(5000).optional(),
    lost_copies: z.coerce.number().int().min(0).max(5000).optional(),
    condition_status: nullableOptStr.optional(),
    damage_notes: nullableOptStr.optional(),
    shelf_location: nullableOptStr.optional(),
    inventory_status: nullableOptStr.optional(),
    status: nullableOptStr.optional(),
    copies: z.array(bookCopyInputSchema).max(500).optional(),
    sync_counts_from_copies: z.boolean().optional(),
  })
  .strict();

export const inventoryUpdatePayloadSchema = z
  .object({
    book_id: z.coerce.number().int().positive().optional(),
    total_copies: z.coerce.number().int().min(0).max(5000).optional(),
    volumes: z.coerce.number().int().min(0).max(5000).optional(),
    available_copies: z.coerce.number().int().min(0).max(5000).optional(),
    borrowed_copies: z.coerce.number().int().min(0).max(5000).optional(),
    damaged_copies: z.coerce.number().int().min(0).max(5000).optional(),
    destroyed_copies: z.coerce.number().int().min(0).max(5000).optional(),
    lost_copies: z.coerce.number().int().min(0).max(5000).optional(),
    condition_status: nullableOptStr.optional(),
    damage_notes: nullableOptStr.optional(),
    shelf_location: nullableOptStr.optional(),
    status: nullableOptStr.optional(),
    is_borrowable: z.union([z.boolean(), z.string(), z.number()]).optional(),
    copies: z.array(bookCopyInputSchema).max(500).optional(),
    sync_counts_from_copies: z.boolean().optional(),
  })
  .strict();

export const bookCopyAddPayloadSchema = z
  .object({
    book_id: z.coerce.number().int().positive("Book ID is required."),
    accession_number: z.string().trim().min(1).max(80).optional(),
    condition: z.enum(BOOK_COPY_CONDITIONS).optional().default("Good"),
    condition_notes: nullableOptStr.optional(),
    shelf_location: nullableOptStr.optional(),
  })
  .strict();

export const bookCopyUpdatePayloadSchema = z
  .object({
    copy_id: z.coerce.number().int().positive().optional(),
    book_id: z.coerce.number().int().positive().optional(),
    accession_number: z.string().trim().min(1).max(80).optional(),
    condition: z.enum(BOOK_COPY_CONDITIONS).optional(),
    circulation_status: z.enum(BOOK_COPY_CIRCULATION_STATUSES).optional(),
    condition_notes: nullableOptStr.optional(),
    shelf_location: nullableOptStr.optional(),
  })
  .strict();

export const bookCopyRetirePayloadSchema = z
  .object({
    copy_id: z.coerce.number().int().positive().optional(),
    book_id: z.coerce.number().int().positive().optional(),
    condition: z
      .enum(["Damaged", "Destroyed", "Lost", "Under Repair"])
      .optional()
      .default("Destroyed"),
    condition_notes: nullableOptStr.optional(),
    reason: nullableOptStr.optional(),
  })
  .strict();

export const bookCopyDeletePayloadSchema = z
  .object({
    copy_id: z.coerce.number().int().positive().optional(),
    book_id: z.coerce.number().int().positive().optional(),
  })
  .strict();

export const accountCreateSchema = z
  .object({
    firstname: z
      .string()
      .trim()
      .min(2, "Valid first name, last name, and email are required.")
      .max(64, "First name must be 64 characters or fewer."),
    lastname: z
      .string()
      .trim()
      .min(2, "Valid first name, last name, and email are required.")
      .max(64, "Last name must be 64 characters or fewer."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Valid first name, last name, and email are required.")
      .max(160),
    password: z
      .string()
      .regex(
        /^[A-Za-z\d@$!%*?&_#^]{8,64}$/,
        "Password must be 8-64 chars with uppercase, lowercase, number, and symbol (@$!%*?&_#^)."
      )
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#^]).{8,64}$/,
        "Password must be 8-64 chars with uppercase, lowercase, number, and symbol (@$!%*?&_#^)."
      ),
    role: z.enum(["admin", "librarian", "user"]).optional(),
    gender: nullableOptStr.optional(),
    phone_number: nullableOptStr.optional(),
    phone: nullableOptStr.optional(),
  })
  .strict();

export const accountResetPasswordSchema = z
  .object({
    new_password: z
      .string()
      .regex(
        /^[A-Za-z\d@$!%*?&_#^]{8,64}$/,
        "New password must be 8-64 chars with uppercase, lowercase, number, and symbol (@$!%*?&_#^)."
      )
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#^]).{8,64}$/,
        "New password must be 8-64 chars with uppercase, lowercase, number, and symbol (@$!%*?&_#^)."
      ),
  })
  .strict();

export const accountToggleActiveSchema = z
  .object({
    is_active: z.boolean(),
  })
  .strict();

export const accountRequestReviewSchema = z
  .object({
    note: nullableOptStr.optional(),
    admin_note: nullableOptStr.optional(),
  })
  .strict();

export const libraryCardBookItemSchema = z.union([
  z.coerce.number().int().positive(),
  z
    .object({
      id: z.coerce.number().int().positive().optional(),
      book_id: z.coerce.number().int().positive().optional(),
      isbn: nullableOptStr.optional(),
      copy_id: z.coerce.number().int().positive().optional(),
      qty: z.coerce.number().int().min(1).max(100).optional(),
      quantity: z.coerce.number().int().min(1).max(100).optional(),
    })
    .strict(),
]);

export const libraryCardCreateSchema = z
  .object({
    card_type_category: z.enum(["member", "borrower"]).optional().default("borrower"),
    user_id: nullableIdSchema,
    firstname: z.string().trim().min(1, "First name and last name are required.").max(100),
    lastname: z.string().trim().min(1, "First name and last name are required.").max(100),
    phone_number: nullableOptStr.optional(),
    phone: nullableOptStr.optional(),
    address: nullableOptStr.optional(),
    date_issued: nullableOptStr.optional(),
    date_return: nullableOptStr.optional(),
    card_type: nullableOptStr.optional(),
    valid_until: nullableOptStr.optional(),
    photo_path: nullableOptStr.optional(),
    renewal1_checked: z.union([z.boolean(), z.string(), z.number()]).optional(),
    renewal1_date: nullableOptStr.optional(),
    renewal2_checked: z.union([z.boolean(), z.string(), z.number()]).optional(),
    renewal2_date: nullableOptStr.optional(),
    book_id: nullableIdSchema,
    book_isbn: nullableOptStr.optional(),
    isbn: nullableOptStr.optional(),
    copy_id: nullableIdSchema,
    quantity: z.coerce.number().int().min(1).max(100).optional().default(1),
    book_ids: z.array(libraryCardBookItemSchema).optional(),
  })
  .strict();

export const libraryCardUpdateSchema = z
  .object({
    firstname: nullableOptStr.optional(),
    lastname: nullableOptStr.optional(),
    phone_number: nullableOptStr.optional(),
    phone: nullableOptStr.optional(),
    address: nullableOptStr.optional(),
    card_type: nullableOptStr.optional(),
    date_return: nullableOptStr.optional(),
    valid_until: nullableOptStr.optional(),
    photo_path: nullableOptStr.optional(),
    renewal1_checked: z.union([z.boolean(), z.string(), z.number()]).optional(),
    renewal1_date: nullableOptStr.optional(),
    renewal2_checked: z.union([z.boolean(), z.string(), z.number()]).optional(),
    renewal2_date: nullableOptStr.optional(),
    book_ids: z.array(libraryCardBookItemSchema).optional(),
  })
  .strict();

export const libraryCardReturnItemSchema = z
  .object({
    row_index: z.coerce.number().int().min(0).optional(),
    card_book_id: z.coerce.number().int().positive().optional(),
    qty_returned: z.coerce.number().int().min(0).max(100),
    return_condition: z
      .enum(["Good", "Fair", "Damaged", "Destroyed", "Lost"])
      .optional()
      .default("Good"),
    condition_notes: nullableOptStr.optional(),
  })
  .strict();

export const libraryCardReturnSchema = z
  .object({
    return_date: nullableOptStr.optional(),
    card_id: nullableIdSchema,
    items: z.array(libraryCardReturnItemSchema).optional(),
  })
  .strict();

export const libraryCardMarkIncidentSchema = z
  .object({
    card_book_id: z.coerce.number().int().positive().optional(),
    copy_id: z.coerce.number().int().positive().optional(),
    reason: z
      .string()
      .trim()
      .min(3, "A reason (at least 3 characters) is required.")
      .max(300, "Reason must be 300 characters or fewer."),
    condition_notes: nullableOptStr.optional(),
  })
  .strict();

export const libraryCardWaiveFineSchema = z
  .object({
    return_id: z.coerce.number().int().positive().optional(),
    card_book_id: z.coerce.number().int().positive().optional(),
    reason: z
      .string()
      .trim()
      .min(3, "A waiver reason (at least 3 characters) is required.")
      .max(300, "Waiver reason must be 300 characters or fewer."),
  })
  .strict();

export const libraryCardDeleteSchema = z.object({}).strict();
export const returnItemDeleteSchema = z.object({}).strict();

export const systemSettingsUpdateSchema = z
  .object({
    maintenance_enabled: z.boolean().optional().default(false),
    maintenance_message: z.string().trim().max(500).optional().default(""),
    bypass_role: z.enum(["admin", "admin_librarian"]).optional().default("admin"),
    lockdown_enabled: z.boolean().optional().default(false),
    backup_frequency: z
      .enum(["hourly", "daily", "weekly", "monthly", "off"])
      .optional()
      .default("weekly"),
    confirm: z.boolean().optional(),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export const systemSettingsLockdownSchema = z
  .object({
    enabled: z.boolean(),
    confirm: z.literal(true, {
      message: "Explicit confirmation (confirm: true) is required.",
    }),
    reason: z
      .string()
      .trim()
      .min(3, "A reason (at least 3 characters) is required to toggle lockdown.")
      .max(300, "Reason must be 300 characters or fewer."),
  })
  .strict();

export const systemSettingsScheduleSchema = z
  .object({
    frequency: z.enum(["hourly", "daily", "weekly", "monthly", "off"]).optional(),
    backup_frequency: z.enum(["hourly", "daily", "weekly", "monthly", "off"]).optional(),
  })
  .strict()
  .refine((d) => Boolean(d.frequency || d.backup_frequency), {
    message: "Backup frequency is required.",
    path: ["frequency"],
  });

export const systemSettingsBackupSchema = z
  .object({
    scope: z.string().trim().max(160).optional().default("Supabase Full Database Snapshot"),
  })
  .strict();

export const backupRestoreSchema = z
  .object({
    backup_log_id: z.coerce.number().int().positive("A valid backup log ID is required."),
    confirm: z.literal("RESTORE", {
      message: 'Explicit confirmation (confirm: "RESTORE") is required to restore a backup.',
    }),
    reason: z.string().trim().min(3, "A restore reason is required.").max(300).optional(),
  })
  .strict();
