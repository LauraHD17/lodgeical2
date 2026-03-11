-- Migration 054: Add pet_policy text field to properties
-- Guest-facing policy text, alongside terms_and_conditions, incidental_policy, etc.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS pet_policy TEXT;
