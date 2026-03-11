-- Migration 050: Option to deduct processing fees from refunds
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS deduct_fees_on_refund BOOLEAN NOT NULL DEFAULT false;
