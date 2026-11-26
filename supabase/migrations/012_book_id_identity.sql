-- ============================================================================
-- Migration 012: Book ID as Canonical Identity (Optional Descriptive ISBN)
-- ============================================================================
-- Orphan-count verification query (run before & after migration to inspect
-- any rows whose book_id could not be linked to public.books):
--
--   SELECT 'library_card_books' AS table_name, COUNT(*) AS unmatched_count
--     FROM public.library_card_books
--    WHERE book_id IS NULL
--   UNION ALL
--   SELECT 'book_return_items' AS table_name, COUNT(*) AS unmatched_count
--     FROM public.book_return_items
--    WHERE book_id IS NULL;
--
-- This migration NEVER deletes data. It converts blank ISBNs to NULL, replaces
-- the hard UNIQUE constraint on books.isbn with a partial unique index for
-- non-empty normalized ISBNs, backfills missing book_id FKs from ISBN matches,
-- reports any unmatched rows via RAISE NOTICE, and indexes key columns.

-- 1. Normalize blank / whitespace-only ISBNs to NULL (non-destructive)
UPDATE public.books
   SET isbn = NULL
 WHERE isbn IS NOT NULL
   AND BTRIM(isbn) = '';

-- 2. Drop the hard UNIQUE constraint on books.isbn (if present) and replace
--    with a partial unique index that only enforces uniqueness when ISBN is set.
ALTER TABLE public.books
    ALTER COLUMN isbn DROP NOT NULL;

DO $$
DECLARE
    v_conname TEXT;
BEGIN
    SELECT c.conname INTO v_conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'books'
       AND c.contype = 'u'
       AND pg_get_constraintdef(c.oid) ILIKE '%(isbn)%';

    IF v_conname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.books DROP CONSTRAINT %I', v_conname);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_books_isbn_non_empty
    ON public.books (UPPER(REGEXP_REPLACE(BTRIM(isbn), '[\s-]+', '', 'g')))
    WHERE isbn IS NOT NULL AND BTRIM(isbn) <> '';

-- 3. Ensure book_id columns and indexes exist on circulation tables
ALTER TABLE public.library_card_books
    ADD COLUMN IF NOT EXISTS book_id BIGINT REFERENCES public.books(id) ON DELETE SET NULL;

ALTER TABLE public.book_return_items
    ADD COLUMN IF NOT EXISTS book_id BIGINT REFERENCES public.books(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lcb_book_id
    ON public.library_card_books (book_id)
    WHERE book_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bri_book_id
    ON public.book_return_items (book_id)
    WHERE book_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_book_copies_book_id_status
    ON public.book_copies (book_id, circulation_status);

-- 4. Safe backfill: link missing library_card_books.book_id via normalized ISBN
UPDATE public.library_card_books lcb
   SET book_id = b.id
  FROM public.books b
 WHERE lcb.book_id IS NULL
   AND lcb.book_isbn IS NOT NULL
   AND BTRIM(lcb.book_isbn) <> ''
   AND b.isbn IS NOT NULL
   AND BTRIM(b.isbn) <> ''
   AND UPPER(REGEXP_REPLACE(BTRIM(lcb.book_isbn), '[\s-]+', '', 'g'))
     = UPPER(REGEXP_REPLACE(BTRIM(b.isbn), '[\s-]+', '', 'g'));

-- 5. Safe backfill: link missing book_return_items.book_id via card_book_id first,
--    then via normalized ISBN match
UPDATE public.book_return_items bri
   SET book_id = lcb.book_id
  FROM public.library_card_books lcb
 WHERE bri.book_id IS NULL
   AND bri.card_book_id = lcb.id
   AND lcb.book_id IS NOT NULL;

UPDATE public.book_return_items bri
   SET book_id = b.id
  FROM public.books b
 WHERE bri.book_id IS NULL
   AND bri.book_isbn IS NOT NULL
   AND BTRIM(bri.book_isbn) <> ''
   AND b.isbn IS NOT NULL
   AND BTRIM(b.isbn) <> ''
   AND UPPER(REGEXP_REPLACE(BTRIM(bri.book_isbn), '[\s-]+', '', 'g'))
     = UPPER(REGEXP_REPLACE(BTRIM(b.isbn), '[\s-]+', '', 'g'));

-- 6. Report any remaining unmatched rows without deleting them
DO $$
DECLARE
    v_unmatched_lcb BIGINT;
    v_unmatched_bri BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_unmatched_lcb
      FROM public.library_card_books
     WHERE book_id IS NULL;

    SELECT COUNT(*) INTO v_unmatched_bri
      FROM public.book_return_items
     WHERE book_id IS NULL;

    RAISE NOTICE '012_book_id_identity: unmatched library_card_books=% | unmatched book_return_items=%',
        v_unmatched_lcb, v_unmatched_bri;
END $$;

-- 7. Ensure atomic copy borrow RPC accepts NULL/empty ISBN cleanly
CREATE OR REPLACE FUNCTION public.borrow_book_copy_atomic(
    p_card_id     BIGINT,
    p_book_id     BIGINT,
    p_copy_id     BIGINT,
    p_book_title  TEXT,
    p_book_author TEXT,
    p_book_isbn   TEXT DEFAULT NULL
)
RETURNS TABLE (card_book_id BIGINT, claimed_copy_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_claimed_id BIGINT;
    v_lcb_id     BIGINT;
BEGIN
    UPDATE public.book_copies
       SET circulation_status = 'Borrowed',
           updated_at         = NOW()
     WHERE id                 = p_copy_id
       AND book_id            = p_book_id
       AND circulation_status = 'Available'
    RETURNING id INTO v_claimed_id;

    IF v_claimed_id IS NULL THEN
        RAISE EXCEPTION 'COPY_NOT_AVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.library_card_books (
        card_id,
        book_id,
        copy_id,
        book_title,
        book_author,
        book_isbn,
        quantity,
        loan_status
    )
    VALUES (
        p_card_id,
        p_book_id,
        v_claimed_id,
        p_book_title,
        p_book_author,
        NULLIF(BTRIM(COALESCE(p_book_isbn, '')), ''),
        1,
        'borrowed'
    )
    RETURNING id INTO v_lcb_id;

    RETURN QUERY SELECT v_lcb_id, v_claimed_id;
END;
$$;
