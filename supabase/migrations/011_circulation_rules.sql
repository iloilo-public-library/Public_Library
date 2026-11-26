-- ============================================================================
-- Migration 011: Circulation Rules, Atomic Copy Borrowing & Fines
-- ============================================================================
-- Enforces single-active-loan uniqueness per physical copy, adds server-side
-- fine & waiver tracking columns, and provides an atomic RPC for borrowing
-- a physical book copy inside a single PostgreSQL transaction.

-- 1. Prevent two active loans from referencing the same physical copy
CREATE UNIQUE INDEX IF NOT EXISTS uq_lcb_active_copy
    ON public.library_card_books (copy_id)
    WHERE copy_id IS NOT NULL AND loan_status IN ('borrowed', 'overdue');

-- 2. Fine, incident, and waiver tracking on library_card_books
ALTER TABLE public.library_card_books
    ADD COLUMN IF NOT EXISTS returned_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fine_amount        NUMERIC(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fine_paid          BOOLEAN        NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fine_waived        BOOLEAN        NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fine_waived_by     BIGINT         REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fine_waived_reason TEXT,
    ADD COLUMN IF NOT EXISTS fine_waived_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS incident_reason    TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_lcb_fine_non_negative'
    ) THEN
        ALTER TABLE public.library_card_books
            ADD CONSTRAINT chk_lcb_fine_non_negative CHECK (fine_amount >= 0);
    END IF;
END $$;

-- 3. Server-computed overdue & fine tracking on book_returns
ALTER TABLE public.book_returns
    ADD COLUMN IF NOT EXISTS overdue_days       INTEGER        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fine_amount        NUMERIC(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fine_paid          BOOLEAN        NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fine_waived        BOOLEAN        NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fine_waived_by     BIGINT         REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fine_waived_reason TEXT,
    ADD COLUMN IF NOT EXISTS fine_waived_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS returned_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_returns_fine_non_negative'
    ) THEN
        ALTER TABLE public.book_returns
            ADD CONSTRAINT chk_returns_fine_non_negative CHECK (fine_amount >= 0 AND overdue_days >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lcb_unpaid_fines
    ON public.library_card_books (card_id)
    WHERE fine_amount > 0 AND fine_paid = FALSE AND fine_waived = FALSE;

CREATE INDEX IF NOT EXISTS idx_returns_unpaid_fines
    ON public.book_returns (card_id)
    WHERE fine_amount > 0 AND fine_paid = FALSE AND fine_waived = FALSE;

-- 4. Atomic copy borrow RPC: conditionally marks an Available copy as Borrowed
--    and inserts the library_card_books loan record in one transaction.
CREATE OR REPLACE FUNCTION public.borrow_book_copy_atomic(
    p_card_id     BIGINT,
    p_book_id     BIGINT,
    p_copy_id     BIGINT,
    p_book_title  TEXT,
    p_book_author TEXT,
    p_book_isbn   TEXT
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
        p_book_isbn,
        1,
        'borrowed'
    )
    RETURNING id INTO v_lcb_id;

    RETURN QUERY SELECT v_lcb_id, v_claimed_id;
END;
$$;
