-- ============================================================================
-- Migration 013: Widen public.users.username to VARCHAR(255)
-- Ensures full email addresses and blind-index values up to 255 characters
-- can be stored without length-limit errors.
-- ============================================================================

ALTER TABLE public.users
  ALTER COLUMN username TYPE VARCHAR(255);
