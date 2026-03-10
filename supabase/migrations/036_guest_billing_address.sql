-- 036: Add billing address columns to guests table
-- Auto-populated from Stripe billing details on successful payment,
-- editable by guest via guest portal.

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS billing_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS billing_city          TEXT,
  ADD COLUMN IF NOT EXISTS billing_state         TEXT,
  ADD COLUMN IF NOT EXISTS billing_postal_code   TEXT,
  ADD COLUMN IF NOT EXISTS billing_country       TEXT;
