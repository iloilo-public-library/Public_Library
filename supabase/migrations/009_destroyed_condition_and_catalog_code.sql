-- ============================================================================
-- Iloilo City Public Library — Migration 009: Destroyed Copy Condition & Catalog Code
-- Adds 'Destroyed' to book_copies.condition and book_return_items.return_condition,
-- adds destroyed_copies to book_inventory, and adds catalog_code to books.
-- Run in Supabase Dashboard -> SQL Editor (idempotent; safe to run multiple times)
-- ============================================================================

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS catalog_code VARCHAR(64);

UPDATE public.books
SET catalog_code = COALESCE(NULLIF(TRIM(call_number), ''), 'ICPL-BK-' || LPAD(id::TEXT, 4, '0'))
WHERE catalog_code IS NULL OR TRIM(catalog_code) = '';

CREATE INDEX IF NOT EXISTS idx_books_catalog_code ON public.books (catalog_code);

ALTER TABLE public.book_inventory
  ADD COLUMN IF NOT EXISTS destroyed_copies INTEGER NOT NULL DEFAULT 0;

-- Expand book_copies.condition CHECK constraint to include 'Destroyed'
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.book_copies'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%condition%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%circulation_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.book_copies DROP CONSTRAINT IF EXISTS %I', con.conname);
  END LOOP;

  ALTER TABLE public.book_copies
    ADD CONSTRAINT book_copies_condition_check
    CHECK (condition IN ('Good', 'Fair', 'Damaged', 'Destroyed', 'Lost', 'Under Repair'));
END $$;

-- Expand book_return_items.return_condition CHECK constraint to include 'Destroyed'
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.book_return_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%return_condition%'
  LOOP
    EXECUTE format('ALTER TABLE public.book_return_items DROP CONSTRAINT IF EXISTS %I', con.conname);
  END LOOP;

  ALTER TABLE public.book_return_items
    ADD CONSTRAINT book_return_items_return_condition_check
    CHECK (return_condition IN ('Good', 'Fair', 'Damaged', 'Destroyed', 'Lost'));
END $$;
