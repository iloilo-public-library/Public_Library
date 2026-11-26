import { z } from "zod";
import { passwordSchema, positiveIntSchema } from "@/validators/common";

export const updateUserProfileSchema = z.object({
  action: z.literal("update_profile"),
  firstname: z.string().trim().min(2, "First name must be at least 2 characters.").max(64),
  lastname: z.string().trim().min(2, "Last name must be at least 2 characters.").max(64),
  gender: z.enum(["", "Male", "Female", "Others"]).optional().default(""),
  phone_number: z.string().trim().max(24).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  province: z.string().trim().max(100).optional().default(""),
  school: z.string().trim().max(140).optional().default(""),
  occupation: z.string().trim().max(140).optional().default(""),
});

export const changeUserPasswordSchema = z
  .object({
    action: z.literal("change_password"),
    current_password: z.string().min(1, "Current password is required."),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, "Please confirm your new password."),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "New password and confirmation do not match.",
    path: ["confirm_password"],
  });

export const toggleUserSecuritySchema = z.object({
  action: z.literal("toggle_security"),
  method: z.enum(["otp", "pin"]),
  enabled: z.boolean(),
});

export const submitUserAccountRequestSchema = z.object({
  action: z.literal("submit_account_request"),
  request_type: z.enum(["deactivate", "delete"]),
  reason: z.string().trim().min(5, "Please provide a brief reason (min 5 characters).").max(500),
});

export const clearSearchHistorySchema = z.object({
  action: z.literal("clear_search_history"),
});

export const clearFavoritesSchema = z.object({
  action: z.literal("clear_favorites"),
});

export const userSettingsMutationSchema = z.discriminatedUnion("action", [
  updateUserProfileSchema,
  changeUserPasswordSchema,
  toggleUserSecuritySchema,
  submitUserAccountRequestSchema,
  clearSearchHistorySchema,
  clearFavoritesSchema,
]);

export type UserSettingsMutationInput = z.infer<typeof userSettingsMutationSchema>;

export const userFavoriteSchema = z
  .object({
    book_id: positiveIntSchema,
  })
  .strict();

export const userSearchHistorySchema = z.object({
  query: z.string().trim().min(1, "Search query cannot be empty.").max(255),
});

export const userNotificationActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("read"),
      announcement_id: positiveIntSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("dismiss"),
      announcement_id: positiveIntSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("read_all"),
    })
    .strict(),
]);

export const userRenewCardSchema = z
  .object({
    card_id: positiveIntSchema,
    reason: z.string().trim().max(500).optional().default("Patron requested library card renewal."),
  })
  .strict();
