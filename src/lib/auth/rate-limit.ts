import type { SupabaseClient } from "@supabase/supabase-js";
import { RateLimitError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export interface RateLimitOptions {
  scope: string;
  identifier: string;
  maxAttempts: number;
  windowSeconds: number;
  blockSeconds?: number;
}

interface RateLimitMemEntry {
  attempts: number;
  windowStartMs: number;
  blockedUntilMs: number | null;
}

interface GlobalWithRateLimit {
  __icplRateLimits?: Map<string, RateLimitMemEntry>;
}

const g = globalThis as unknown as GlobalWithRateLimit;

function getMemLimiter(): Map<string, RateLimitMemEntry> {
  if (!g.__icplRateLimits) {
    g.__icplRateLimits = new Map<string, RateLimitMemEntry>();
  }
  return g.__icplRateLimits;
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  return "127.0.0.1";
}

function checkInMemoryLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
  blockMs: number,
  nowMs: number
): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const store = getMemLimiter();
  if (store.size > 2000) {
    for (const [k, v] of store.entries()) {
      const exp = v.blockedUntilMs ?? v.windowStartMs + windowMs;
      if (exp < nowMs) store.delete(k);
    }
  }

  const current = store.get(key);
  if (current?.blockedUntilMs && current.blockedUntilMs > nowMs) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.blockedUntilMs - nowMs) / 1000)),
      remaining: 0,
    };
  }

  if (!current || nowMs - current.windowStartMs >= windowMs) {
    store.set(key, {
      attempts: 1,
      windowStartMs: nowMs,
      blockedUntilMs: maxAttempts <= 1 ? nowMs + blockMs : null,
    });
    return {
      allowed: true,
      retryAfterSec: 0,
      remaining: Math.max(0, maxAttempts - 1),
    };
  }

  const nextAttempts = current.attempts + 1;
  if (nextAttempts > maxAttempts) {
    const blockedUntilMs = nowMs + blockMs;
    store.set(key, {
      ...current,
      attempts: nextAttempts,
      blockedUntilMs,
    });
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(blockMs / 1000)),
      remaining: 0,
    };
  }

  store.set(key, {
    ...current,
    attempts: nextAttempts,
  });

  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, maxAttempts - nextAttempts),
  };
}

/**
 * Enforces rate limiting using `public.auth_rate_limits` in Supabase when available,
 * with an automatic in-memory fallback so tests and unmigrated environments stay protected.
 */
export async function enforceRateLimit(
  options: RateLimitOptions,
  supabase?: SupabaseClient | null
): Promise<void> {
  const normalizedId = options.identifier.trim().toLowerCase().slice(0, 180) || "anon";
  const key = `${options.scope}:${normalizedId}`.slice(0, 250);
  const windowMs = options.windowSeconds * 1000;
  const blockMs = (options.blockSeconds ?? options.windowSeconds) * 1000;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // Always check/update in-memory first for instant zero-latency protection
  const memResult = checkInMemoryLimit(
    key,
    options.maxAttempts,
    windowMs,
    blockMs,
    nowMs
  );

  if (supabase) {
    try {
      const { data: row, error: selErr } = await supabase
        .from("auth_rate_limits")
        .select("key, attempts, window_start, blocked_until")
        .eq("key", key)
        .maybeSingle();

      if (!selErr) {
        if (row?.blocked_until) {
          const blockedMs = Date.parse(String(row.blocked_until));
          if (Number.isFinite(blockedMs) && blockedMs > nowMs) {
            const retryAfterSec = Math.max(1, Math.ceil((blockedMs - nowMs) / 1000));
            throw new RateLimitError(
              `Too many attempts. Please try again in ${retryAfterSec} seconds.`,
              retryAfterSec
            );
          }
        }

        const winStartMs = row?.window_start ? Date.parse(String(row.window_start)) : 0;
        const windowExpired = !row || !Number.isFinite(winStartMs) || nowMs - winStartMs >= windowMs;
        const nextAttempts = windowExpired ? 1 : Number(row.attempts ?? 0) + 1;

        if (nextAttempts > options.maxAttempts) {
          const blockedUntilIso = new Date(nowMs + blockMs).toISOString();
          await supabase.from("auth_rate_limits").upsert(
            {
              key,
              attempts: nextAttempts,
              window_start: windowExpired ? nowIso : row.window_start,
              blocked_until: blockedUntilIso,
              updated_at: nowIso,
            },
            { onConflict: "key" }
          );
          const retryAfterSec = Math.max(1, Math.ceil(blockMs / 1000));
          logger.security("Rate limit triggered", { scope: options.scope, retryAfterSec });
          throw new RateLimitError(
            `Too many attempts. Please try again in ${retryAfterSec} seconds.`,
            retryAfterSec
          );
        }

        await supabase.from("auth_rate_limits").upsert(
          {
            key,
            attempts: nextAttempts,
            window_start: windowExpired ? nowIso : row.window_start,
            blocked_until: null,
            updated_at: nowIso,
          },
          { onConflict: "key" }
        );
        return;
      }
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      // If table is not yet migrated, fall through to in-memory result
    }
  }

  if (!memResult.allowed) {
    logger.security("Rate limit triggered (memory)", {
      scope: options.scope,
      retryAfterSec: memResult.retryAfterSec,
    });
    throw new RateLimitError(
      `Too many attempts. Please try again in ${memResult.retryAfterSec} seconds.`,
      memResult.retryAfterSec
    );
  }
}

export function clearRateLimitMemory(): void {
  getMemLimiter().clear();
}
