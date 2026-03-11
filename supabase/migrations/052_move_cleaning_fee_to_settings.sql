-- Migration 052: Move cleaning_fee_cents from properties to settings
-- It logically belongs with other fee settings (pet_fee, tax_rate, etc.)

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS cleaning_fee_cents INT NOT NULL DEFAULT 0;

-- Copy existing values from properties to settings
UPDATE settings s
  SET cleaning_fee_cents = p.cleaning_fee_cents
  FROM properties p
  WHERE s.property_id = p.id
    AND p.cleaning_fee_cents > 0;

-- Drop from properties (no longer needed there)
ALTER TABLE properties DROP COLUMN IF EXISTS cleaning_fee_cents;
