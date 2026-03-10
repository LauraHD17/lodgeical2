-- Add calendar color to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'Sage';
