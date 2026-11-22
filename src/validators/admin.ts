import { z } from "zod";
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
  "announcements",
  "system_settings",
  "backup_logs",
  "admin_profile",
  "isbn_lookup",
  "error_logs",
] as const;

export const adminResourceSchema = z.enum(ADMIN_RESOURCES);
export type AdminResource = z.infer<typeof adminResourceSchema>;

export const adminQuerySchema = z.object({
  resource: adminResourceSchema,
  isbn: z.string().trim().optional(),
});

export const adminMutationSchema = z.object({
  resource: adminResourceSchema,
  action: z.string().trim().min(1).optional(),
  id: nullableIdSchema,
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export type AdminQueryInput = z.infer<typeof adminQuerySchema>;
export type AdminMutationInput = z.infer<typeof adminMutationSchema>;

export const staffAppearanceSchema = z.object({
  theme: z.enum(["default", "dark", "light", "ocean"]).default("default"),
  language: z.enum(["english", "filipino", "hiligaynon"]).default("english"),
});

export const adminUpdateProfileSchema = z.object({
  firstname: z
    .string()
    .trim()
    .min(2, "First name must be at least 2 characters.")
    .max(64, "First name must be 64 characters or fewer."),
  lastname: z
    .string()
    .trim()
    .min(2, "Last name must be at least 2 characters.")
    .max(64, "Last name must be 64 characters or fewer."),
  gender: z
    .enum(["Male", "Female", "Others", ""])
    .optional()
    .default(""),
  phone_number: z
    .string()
    .trim()
    .max(20, "Phone number must be 20 characters or fewer.")
    .refine(
      (v) => v === "" || /^[0-9+\-\s()]{7,20}$/.test(v),
      "Phone number must be 7-20 valid phone characters."
    )
    .optional()
    .default(""),
});

export const adminChangePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required."),
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
    confirm_password: z.string().min(1, "Confirm password is required."),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "New password and confirmation do not match.",
    path: ["confirm_password"],
  });

export const adminToggleSecuritySchema = z.object({
  method: z.enum(["otp", "pin"]),
  enabled: z.boolean(),
});

export const adminSetPinSchema = z
  .object({
    password: z.string().min(1, "Current password is required."),
    pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits."),
    confirm: z.string().regex(/^\d{6}$/, "PIN confirmation must be exactly 6 digits."),
  })
  .refine((d) => d.pin === d.confirm, {
    message: "PIN and confirmation do not match.",
    path: ["confirm"],
  });

export const adminUsersQuerySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(120).optional().default(""),
  role: z.enum(["all", "user", "librarian", "admin"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});
