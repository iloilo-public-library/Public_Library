import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

const serverEnvSchema = publicEnvSchema.extend({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SECRET_KEY: z.string().min(1).optional(),
  ENCRYPTION_KEY: z.string().min(1).optional(),
  PII_ENCRYPTION_KEY: z.string().min(1).optional(),
  EMAIL_ENCRYPTION_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.string().min(1).optional(),
  EVENT_REMINDER_EMAILS_ENABLED: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  DROPBOX_APP_KEY: z.string().min(1).optional(),
  DROPBOX_APP_SECRET: z.string().min(1).optional(),
  DROPBOX_REFRESH_TOKEN: z.string().min(1).optional(),
  DROPBOX_COVERS_FOLDER: z.string().min(1).optional(),
  DROPBOX_EVENTS_FOLDER: z.string().min(1).optional(),
  DROPBOX_FOLDER: z.string().min(1).optional(),
  FLASK_BACKEND_URL: z.string().url().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  });
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
    SUPABASE_URL: process.env.SUPABASE_URL || undefined,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || undefined,
    SECRET_KEY: process.env.SECRET_KEY || undefined,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || undefined,
    PII_ENCRYPTION_KEY: process.env.PII_ENCRYPTION_KEY || undefined,
    EMAIL_ENCRYPTION_KEY: process.env.EMAIL_ENCRYPTION_KEY || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    RESEND_FROM: process.env.RESEND_FROM || undefined,
    EVENT_REMINDER_EMAILS_ENABLED: process.env.EVENT_REMINDER_EMAILS_ENABLED || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    DROPBOX_APP_KEY: process.env.DROPBOX_APP_KEY || undefined,
    DROPBOX_APP_SECRET: process.env.DROPBOX_APP_SECRET || undefined,
    DROPBOX_REFRESH_TOKEN: process.env.DROPBOX_REFRESH_TOKEN || undefined,
    DROPBOX_COVERS_FOLDER: process.env.DROPBOX_COVERS_FOLDER || undefined,
    DROPBOX_EVENTS_FOLDER: process.env.DROPBOX_EVENTS_FOLDER || undefined,
    DROPBOX_FOLDER: process.env.DROPBOX_FOLDER || undefined,
    FLASK_BACKEND_URL: process.env.FLASK_BACKEND_URL || undefined,
  });
}

export function getFlaskBackendUrl(): string {
  return (process.env.FLASK_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");
}
