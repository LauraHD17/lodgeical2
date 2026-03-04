-- Migration 016: add pass_through_stripe_fee to settings
-- When true, the Stripe processing fee is added on top of the nightly rate
-- so the host receives the advertised rate net of fees.

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS pass_through_stripe_fee BOOLEAN NOT NULL DEFAULT false;
