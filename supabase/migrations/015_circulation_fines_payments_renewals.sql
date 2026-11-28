-- ============================================================================
-- Migration 015: Circulation Fines, Payments & Renewal Integrity
-- ============================================================================
-- 1. Enforce at most one pending renewal request per library card at DB level.
-- 2. Create public.fine_payments for auditable, idempotent fine collection
--    (partial & full payments by admin or librarian).

CREATE UNIQUE INDEX IF NOT EXISTS uq_ar_pending_renew_card
    ON public.account_requests (card_id)
    WHERE request_type = 'renew'
      AND status = 'pending'
      AND card_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.fine_payments (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    card_id         BIGINT NOT NULL REFERENCES public.library_cards(id) ON DELETE CASCADE,
    return_id       BIGINT REFERENCES public.book_returns(id) ON DELETE SET NULL,
    card_book_id    BIGINT REFERENCES public.library_card_books(id) ON DELETE SET NULL,
    user_id         BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    amount_paid     NUMERIC(10, 2) NOT NULL CHECK (amount_paid > 0),
    payment_method  VARCHAR(40) NOT NULL DEFAULT 'cash',
    receipt_note    TEXT,
    recorded_by     BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fine_payments_card_id
    ON public.fine_payments (card_id);

CREATE INDEX IF NOT EXISTS idx_fine_payments_user_id
    ON public.fine_payments (user_id)
    WHERE user_id IS NOT NULL;
