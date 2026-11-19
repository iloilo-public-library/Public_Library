import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

export function getSupabaseSecretKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!key || key.startsWith("REPLACE_")) return "";
  return key;
}

function getSupabasePublishableKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

/**
 * Server-only Supabase admin client using SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).
 * Falls back to publishable key for read-only public tables when useSecret is false.
 */
export function createSupabaseServerClient(useSecret = true): SupabaseClient {
  const url = getSupabaseUrl();
  if (!url) {
    throw new Error("SUPABASE_URL is not configured in environment variables.");
  }

  const secret = getSupabaseSecretKey();
  const key = useSecret && secret ? secret : getSupabasePublishableKey();

  if (!key) {
    throw new Error("Supabase API key is missing in environment variables.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && (getSupabaseSecretKey() || getSupabasePublishableKey()));
}
