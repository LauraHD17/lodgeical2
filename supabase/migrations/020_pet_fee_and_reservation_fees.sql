-- 020_pet_fee_and_reservation_fees.sql
-- Pet fee configuration at property and room level,
-- plus per-reservation fee override columns.

-- Property-level pet fee defaults
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS pet_fee_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pet_fee_type  TEXT NOT NULL DEFAULT 'flat'
    CHECK (pet_fee_type IN ('flat', 'per_night'));

-- Per-room overrides (NULL = inherit from property default)
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS allows_pets        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cleaning_fee_cents INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pet_fee_cents      INT DEFAULT NULL;

-- Per-reservation fee controls (innkeeper-only at booking time)
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS cleaning_fee_waived       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cleaning_fee_waive_reason TEXT,
  ADD COLUMN IF NOT EXISTS pet_fee_applied           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tax_exempt                BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tax_exempt_org            TEXT;
