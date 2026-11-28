-- ============================================================================
-- Migration 014: Circulation Integrity & Atomic Borrow-Limit RPC
-- ============================================================================
-- 1. Updates borrow_book_copy_atomic to restrict claimable copy condition to
--    ('Good', 'Fair').
-- 2. Adds borrow_card_books_atomic to serialize member borrow-limit checks
--    (FOR UPDATE on public.users) and claim all copies/inventory for a card
--    inside a single atomic PostgreSQL transaction.

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
       AND condition IN ('Good', 'Fair')
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

CREATE OR REPLACE FUNCTION public.borrow_card_books_atomic(
    p_card_id    BIGINT,
    p_user_id    BIGINT DEFAULT NULL,
    p_max_active INTEGER DEFAULT 5,
    p_items      JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (card_book_id BIGINT, claimed_copy_id BIGINT, book_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active_count  INTEGER := 0;
    v_requested_qty INTEGER := 0;
    v_item          JSONB;
    v_book_id       BIGINT;
    v_copy_id       BIGINT;
    v_qty           INTEGER;
    v_title         TEXT;
    v_author        TEXT;
    v_isbn          TEXT;
    v_has_copies    BOOLEAN;
    v_claimed_id    BIGINT;
    v_lcb_id        BIGINT;
    v_inv_id        BIGINT;
    v_i             INTEGER;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'INVALID_BORROW_ITEMS' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(SUM(GREATEST(1, COALESCE((elem->>'qty')::INTEGER, 1))), 0)
      INTO v_requested_qty
      FROM jsonb_array_elements(p_items) AS elem;

    IF p_user_id IS NOT NULL THEN
        -- Serialize concurrent borrows for the same member
        PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;

        SELECT COALESCE(SUM(GREATEST(1, COALESCE(lcb.quantity, 1))), 0)
          INTO v_active_count
          FROM public.library_card_books lcb
          JOIN public.library_cards lc ON lc.id = lcb.card_id
         WHERE lc.user_id = p_user_id
           AND lc.id <> p_card_id
           AND lcb.loan_status IN ('borrowed', 'overdue');

        IF (v_active_count + v_requested_qty) > p_max_active THEN
            RAISE EXCEPTION 'BORROW_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
        END IF;
    ELSE
        IF v_requested_qty > p_max_active THEN
            RAISE EXCEPTION 'BORROW_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_book_id := (v_item->>'book_id')::BIGINT;
        v_copy_id := NULLIF(BTRIM(COALESCE(v_item->>'copy_id', '')), '')::BIGINT;
        v_qty     := GREATEST(1, COALESCE((v_item->>'qty')::INTEGER, 1));
        v_title   := COALESCE(v_item->>'title', '');
        v_author  := COALESCE(v_item->>'author', '');
        v_isbn    := NULLIF(BTRIM(COALESCE(v_item->>'isbn', '')), '');

        IF v_copy_id IS NOT NULL THEN
            UPDATE public.book_copies
               SET circulation_status = 'Borrowed',
                   updated_at         = NOW()
             WHERE id                 = v_copy_id
               AND book_id            = v_book_id
               AND circulation_status = 'Available'
               AND condition IN ('Good', 'Fair')
            RETURNING id INTO v_claimed_id;

            IF v_claimed_id IS NULL THEN
                RAISE EXCEPTION 'COPY_NOT_AVAILABLE' USING ERRCODE = 'P0001';
            END IF;

            INSERT INTO public.library_card_books (
                card_id, book_id, copy_id, book_title, book_author, book_isbn, quantity, loan_status
            )
            VALUES (
                p_card_id, v_book_id, v_claimed_id, v_title, v_author, v_isbn, 1, 'borrowed'
            )
            RETURNING id INTO v_lcb_id;

            RETURN QUERY SELECT v_lcb_id, v_claimed_id, v_book_id;
        ELSE
            SELECT EXISTS(SELECT 1 FROM public.book_copies bc WHERE bc.book_id = v_book_id)
              INTO v_has_copies;

            IF v_has_copies THEN
                FOR v_i IN 1..v_qty LOOP
                    SELECT bc.id
                      INTO v_claimed_id
                      FROM public.book_copies bc
                     WHERE bc.book_id = v_book_id
                       AND bc.circulation_status = 'Available'
                       AND bc.condition IN ('Good', 'Fair')
                     ORDER BY bc.copy_number ASC, bc.id ASC
                     LIMIT 1
                     FOR UPDATE SKIP LOCKED;

                    IF v_claimed_id IS NULL THEN
                        RAISE EXCEPTION 'COPY_NOT_AVAILABLE' USING ERRCODE = 'P0001';
                    END IF;

                    UPDATE public.book_copies
                       SET circulation_status = 'Borrowed',
                           updated_at         = NOW()
                     WHERE id = v_claimed_id;

                    INSERT INTO public.library_card_books (
                        card_id, book_id, copy_id, book_title, book_author, book_isbn, quantity, loan_status
                    )
                    VALUES (
                        p_card_id, v_book_id, v_claimed_id, v_title, v_author, v_isbn, 1, 'borrowed'
                    )
                    RETURNING id INTO v_lcb_id;

                    RETURN QUERY SELECT v_lcb_id, v_claimed_id, v_book_id;
                END LOOP;
            ELSE
                UPDATE public.book_inventory
                   SET available_copies = available_copies - v_qty,
                       borrowed_copies  = COALESCE(borrowed_copies, 0) + v_qty,
                       updated_at       = NOW()
                 WHERE book_id          = v_book_id
                   AND available_copies >= v_qty
                RETURNING id INTO v_inv_id;

                IF v_inv_id IS NULL THEN
                    RAISE EXCEPTION 'COPY_NOT_AVAILABLE' USING ERRCODE = 'P0001';
                END IF;

                INSERT INTO public.library_card_books (
                    card_id, book_id, copy_id, book_title, book_author, book_isbn, quantity, loan_status
                )
                VALUES (
                    p_card_id, v_book_id, NULL, v_title, v_author, v_isbn, v_qty, 'borrowed'
                )
                RETURNING id INTO v_lcb_id;

                RETURN QUERY SELECT v_lcb_id, NULL::BIGINT, v_book_id;
            END IF;
        END IF;
    END LOOP;
END;
$$;
