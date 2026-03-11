-- Migration 051: Cancellation fee options
-- Replaces simple deduct_fees_on_refund boolean with more flexible options:
-- cancellation_fee_type: 'none' | 'processing' | 'flat' | 'both'
-- cancellation_fee_cents: flat fee per room (when type is 'flat' or 'both')

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS cancellation_fee_type TEXT NOT NULL DEFAULT 'none'
    CHECK (cancellation_fee_type IN ('none', 'processing', 'flat', 'both')),
  ADD COLUMN IF NOT EXISTS cancellation_fee_cents INT NOT NULL DEFAULT 0;

-- Migrate existing deduct_fees_on_refund boolean
UPDATE settings SET cancellation_fee_type = 'processing'
  WHERE deduct_fees_on_refund = true;

ALTER TABLE settings DROP COLUMN IF EXISTS deduct_fees_on_refund;
