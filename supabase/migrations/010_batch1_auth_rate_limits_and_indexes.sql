-- ============================================================================
-- Iloilo City Public Library — Migration 010: Batch 1 Auth Rate Limits & Indexes
-- Adds table-backed rate limiting for login/OTP/reset/upload endpoints and
-- indexes for Asia/Manila dashboard stats and login activity queries.
-- Run in Supabase Dashboard -> SQL Editor (idempotent; safe to run multiple times)
-- ============================================================================

-- 1. TABLE-BACKED ABUSE & RATE LIMITING COUNTER
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key VARCHAR(255) PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_blocked_until
  ON public.auth_rate_limits (blocked_until);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_updated_at
  ON public.auth_rate_limits (updated_at);

DROP TRIGGER IF EXISTS trg_auth_rate_limits_updated_at ON public.auth_rate_limits;
CREATE TRIGGER trg_auth_rate_limits_updated_at
  BEFORE UPDATE ON public.auth_rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- 2. INDEXES FOR BATCH 1 LOGIN ACTIVITY, RESET TOKENS, & DASHBOARD ANALYTICS
CREATE INDEX IF NOT EXISTS idx_ls_user_login_desc
  ON public.login_sessions (user_id, login_at DESC);

CREATE INDEX IF NOT EXISTS idx_ls_session_token_active
  ON public.login_sessions (session_token)
  WHERE logout_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_reset_token
  ON public.users (reset_token)
  WHERE reset_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_pin_reset_token
  ON public.users (pin_reset_token)
  WHERE pin_reset_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_books_created_at_desc
  ON public.books (created_at DESC);
