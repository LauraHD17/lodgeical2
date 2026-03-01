-- Migration 006: settings table
-- Per-property configuration. One row per property.

CREATE TABLE settings (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                UUID NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
  tax_rate                   NUMERIC(5,2) NOT NULL DEFAULT 0,  -- e.g. 8.50 means 8.50%
  currency                   TEXT NOT NULL DEFAULT 'USD',
  cancellation_policy        TEXT NOT NULL DEFAULT 'moderate'
                               CHECK (cancellation_policy IN ('flexible','moderate','strict')),
  stripe_account_id          TEXT,   -- server-only; never returned to public endpoints
  stripe_publishable_key     TEXT,   -- used by the booking widget
  check_in_time              TEXT NOT NULL DEFAULT '15:00',
  check_out_time             TEXT NOT NULL DEFAULT '11:00',
  min_stay_nights            INTEGER NOT NULL DEFAULT 1,
  require_payment_at_booking BOOLEAN NOT NULL DEFAULT false,
  allow_partial_payment      BOOLEAN NOT NULL DEFAULT true
);
