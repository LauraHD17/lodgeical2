-- 015_settings_cleaning_fee.sql
-- Adds a per-property cleaning fee to the properties table.
-- Used in the Rates page fee calculator and booking widget pricing.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS cleaning_fee_cents INT NOT NULL DEFAULT 0;
