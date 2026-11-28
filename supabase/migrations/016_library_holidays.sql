-- ============================================================================
-- Migration 016: Library Holidays Calendar
-- ============================================================================
-- Stores official closed holidays used by circulation overdue & due-date rules.

CREATE TABLE IF NOT EXISTS public.library_holidays (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    holiday_date DATE         NOT NULL UNIQUE,
    name         VARCHAR(160) NOT NULL,
    created_by   BIGINT       REFERENCES public.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_holidays_date
    ON public.library_holidays (holiday_date);

ALTER TABLE public.library_holidays ENABLE ROW LEVEL SECURITY;
