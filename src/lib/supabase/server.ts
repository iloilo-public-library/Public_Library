import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

/**
 * Server-only Supabase admin client using SUPABASE_SECRET_KEY.
 * Falls back to publishable key for read-only public tables if secret key is not set yet.
 */
export function createSupabaseServerClient(useSecret = true): SupabaseClient {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured in environment variables.");
  }

  const key =
    useSecret && SUPABASE_SECRET_KEY && !SUPABASE_SECRET_KEY.startsWith("REPLACE_")
      ? SUPABASE_SECRET_KEY
      : SUPABASE_PUBLISHABLE_KEY;

  if (!key) {
    throw new Error("Supabase API key is missing in environment variables.");
  }

  return createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && (SUPABASE_SECRET_KEY || SUPABASE_PUBLISHABLE_KEY));
}
