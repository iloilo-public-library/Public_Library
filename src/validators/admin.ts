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
