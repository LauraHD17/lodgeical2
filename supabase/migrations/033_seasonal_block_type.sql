-- Migration 033: Add 'seasonal' block type
-- Extends the block_type CHECK constraint to include seasonal closures.

-- Drop existing constraint and re-create with the new value
ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_block_type_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_block_type_check
    CHECK (block_type IN ('maintenance', 'owner_block', 'seasonal'));
