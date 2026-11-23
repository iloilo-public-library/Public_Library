import { z } from "zod";

export const positiveIntSchema = z.coerce.number().int().positive();

export const nullableIdSchema = z
  .union([z.number().int().positive(), z.string().min(1), z.literal(""), z.null()])
  .optional()
  .transform((val) => {
    if (val === null || val === undefined || val === "") return null;
    return val;
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(64, "Password must be at most 64 characters.");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
