-- Migration: 006_mercadopago_payments.sql
-- Description: Add payment provider tracking fields to transactions table
-- for Mercado Pago integration

-- Note: The metadata JSONB column already exists and can store provider-specific
-- data (mp_preference_id, provider_payment_id, etc.), so we don't need to add
-- dedicated columns. This migration adds useful indexes for querying.

-- Index for fast lookup by provider payment ID stored in metadata
-- Used by webhook handler for idempotency checks
CREATE INDEX IF NOT EXISTS idx_transactions_provider_payment_id
    ON public.transactions USING gin ((metadata->'provider_payment_id'));

-- Index for querying pending transactions (for timeout/cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_transactions_status_type
    ON public.transactions(status, type);
