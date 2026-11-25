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
  .email("Please enter a valid email address.")
  .max(255, "Email address must be 255 characters or fewer.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(64, "Password must be at most 64 characters.")
  .regex(
    /^[A-Za-z\d@$!%*?&_#^]{8,64}$/,
    "Password may only contain letters, numbers, and @$!%*?&_#^."
  )
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#^]).{8,64}$/,
    "Password must include uppercase, lowercase, a number, and a special character (@$!%*?&_#^)."
  );

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    pageSize: z.coerce.number().int().min(1).max(200).optional(),
    q: z.string().trim().max(120).optional().default(""),
    sort: z.string().trim().max(64).optional(),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .strict();
