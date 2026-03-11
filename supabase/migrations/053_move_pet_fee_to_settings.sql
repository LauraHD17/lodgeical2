-- Migration 053: Move pet_fee_cents and pet_fee_type from properties to settings
-- They belong with other fee settings (tax_rate, cleaning_fee, etc.)

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS pet_fee_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pet_fee_type TEXT NOT NULL DEFAULT 'flat'
    CHECK (pet_fee_type IN ('flat', 'per_night'));

-- Copy existing values from properties to settings
UPDATE settings s
  SET pet_fee_cents = p.pet_fee_cents,
      pet_fee_type = p.pet_fee_type
  FROM properties p
  WHERE s.property_id = p.id;

-- Drop from properties
ALTER TABLE properties DROP COLUMN IF EXISTS pet_fee_cents;
ALTER TABLE properties DROP COLUMN IF EXISTS pet_fee_type;
