import { z } from "zod";
import { diffDaysIso, MAX_RANGE_DAYS } from "@/lib/calendar/recurrence";
import { isValidEventCoverRef } from "@/lib/storage";

export const ALLOWED_REMINDER_MINUTES = [10, 30, 60, 1440] as const;
export const BUILTIN_EVENT_CATEGORIES = [
  "general",
  "workshop",
  "holiday",
  "exhibit",
  "closure",
] as const;

const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
const hhmmRe = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const optionalIsoDate = z
  .string()
  .trim()
  .regex(isoDateRe, "Date must be in YYYY-MM-DD format.")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

const optionalTime = z
  .string()
  .trim()
  .regex(hhmmRe, "Time must be in HH:MM format.")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const eventScopeSchema = z.enum(["this", "following", "all"]).default("all");
export type EventEditScope = z.infer<typeof eventScopeSchema>;

export const eventRecurrenceSchema = z
  .object({
    freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval: z.coerce.number().int().min(1).max(12).optional().default(1),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7).nullable().optional(),
    day_of_month: z.coerce.number().int().min(1).max(31).nullable().optional(),
    until: optionalIsoDate,
    count: z.coerce.number().int().min(1).max(366).nullable().optional(),
  })
  .nullable()
  .optional();

export const eventRemindersSchema = z
  .array(
    z.coerce
      .number()
      .int()
      .refine(
        (v) => (ALLOWED_REMINDER_MINUTES as readonly number[]).includes(v),
        "Reminder offset must be one of 10, 30, 60, or 1440 minutes."
      )
  )
  .max(4)
  .optional();

const optionalCoverImageSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v))
  .refine(
    (v) => v === null || v === undefined || isValidEventCoverRef(v),
    "Invalid cover image reference. Upload via /api/storage/upload (folder: event-banners)."
  );

export const eventQueryRangeSchema = z
  .object({
    from: z.string().trim().regex(isoDateRe, "from must be YYYY-MM-DD.").optional(),
    to: z.string().trim().regex(isoDateRe, "to must be YYYY-MM-DD.").optional(),
  })
  .superRefine((val, ctx) => {
    if ((val.from && !val.to) || (!val.from && val.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Both from and to query parameters are required when filtering by range.",
      });
      return;
    }
    if (val.from && val.to) {
      const days = diffDaysIso(val.from, val.to);
      if (days < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "to date cannot be earlier than from date.",
        });
      } else if (days > MAX_RANGE_DAYS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Date range cannot exceed ${MAX_RANGE_DAYS} days.`,
        });
      }
    }
  });

const eventBaseObject = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Event title is required.")
    .max(255, "Event title must be 255 characters or fewer."),
  description: z.string().trim().max(4000).nullable().optional().default(null),
  event_date: z.string().trim().regex(isoDateRe, "Event date must be YYYY-MM-DD."),
  end_date: optionalIsoDate,
  start_time: optionalTime,
  end_time: optionalTime,
  all_day: z.boolean().optional(),
  timezone: z.string().trim().max(64).optional().default("Asia/Manila"),
  location: z.string().trim().max(255).nullable().optional().default(null),
  category: z.string().trim().min(1).max(32).optional().default("general"),
  audience: z.enum(["all", "members", "staff"]).optional().default("all"),
  cover_image: optionalCoverImageSchema,
  image: optionalCoverImageSchema,
  reminders: eventRemindersSchema,
  recurrence: eventRecurrenceSchema,
  scope: eventScopeSchema.optional(),
  occurrence_date: optionalIsoDate,
});

function validateStartEnd(
  val: {
    event_date: string;
    end_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    all_day?: boolean;
  },
  ctx: z.RefinementCtx
) {
  if (val.end_date && val.end_date < val.event_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["end_date"],
      message: "End date cannot be before start date.",
    });
  }
  const sameDay = !val.end_date || val.end_date === val.event_date;
  if (!val.all_day && sameDay && val.start_time && val.end_time) {
    if (val.end_time.slice(0, 5) < val.start_time.slice(0, 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_time"],
        message: "End time cannot be before start time.",
      });
    }
  }
}

export const eventCreateSchema = eventBaseObject.superRefine(validateStartEnd);
export const eventUpdateSchema = eventBaseObject.superRefine(validateStartEnd);

export const eventRescheduleSchema = z
  .object({
    event_date: z.string().trim().regex(isoDateRe, "Event date must be YYYY-MM-DD."),
    end_date: optionalIsoDate,
    start_time: optionalTime,
    end_time: optionalTime,
    all_day: z.boolean().optional(),
    scope: eventScopeSchema.optional(),
    occurrence_date: optionalIsoDate,
  })
  .superRefine(validateStartEnd);

export const eventDeleteScopeSchema = z.object({
  scope: eventScopeSchema.optional().default("all"),
  occurrence_date: optionalIsoDate,
});

const hexColorRe = /^#[0-9a-fA-F]{6}$/;

export const eventCategoryCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,32}$/, "Category slug must be 2-32 lowercase letters, numbers, - or _."),
  name: z.string().trim().min(2).max(80),
  color: z.string().trim().regex(hexColorRe, "Color must be a 6-digit hex code like #48c78e."),
});

export const eventCategoryUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  color: z.string().trim().regex(hexColorRe, "Color must be a 6-digit hex code like #48c78e.").optional(),
});

