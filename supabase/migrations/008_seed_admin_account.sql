-- ============================================================================
-- Iloilo City Public Library — Migration 008: Seed & Normalize Admin Account
-- Ensures anthonyojera47@gmail.com has a normalized username, unlocked status,
-- and known default admin password (Admin@123).
-- Run in Supabase Dashboard -> SQL Editor (idempotent; safe to run multiple times)
-- ============================================================================

INSERT INTO public.users (
  id,
  username,
  email_display,
  firstname,
  lastname,
  password,
  role,
  status,
  phone_number,
  gender,
  is_active,
  is_approved,
  is_locked,
  failed_attempts,
  lock_until,
  otp_enabled,
  pin_enabled,
  is_government
) VALUES (
  1,
  'anthonyojera47@gmail.com',
  'anthonyojera47@gmail.com',
  'Anthony',
  'Ojera',
  '$2b$12$PWuGRI7WO1ytxTYOVjwmMu.4gbTLhbagwQMqUxS3CHFc2WtKSQSEi',
  'admin',
  'active',
  '09171234567',
  'Male',
  TRUE,
  TRUE,
  FALSE,
  0,
  NULL,
  FALSE,
  FALSE,
  FALSE
)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  email_display = EXCLUDED.email_display,
  firstname = EXCLUDED.firstname,
  lastname = EXCLUDED.lastname,
  password = EXCLUDED.password,
  role = 'admin',
  is_active = TRUE,
  is_approved = TRUE,
  is_locked = FALSE,
  failed_attempts = 0,
  lock_until = NULL;

-- Normalize legacy 64-character HMAC blind-index usernames on remaining seeded accounts
UPDATE public.users
SET username = LOWER(TRIM(email_display))
WHERE email_display IS NOT NULL
  AND TRIM(email_display) <> ''
  AND username ~ '^[0-9a-f]{64}$';

SELECT setval(
  pg_get_serial_sequence('public.users', 'id'),
  COALESCE((SELECT MAX(id) FROM public.users), 1)
);
