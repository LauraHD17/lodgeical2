-- Migration 015: reservation blocks
-- Adds maintenance / owner-block support as a first-class concept.
-- block_type is NULL for normal guest reservations (backwards-compatible).
-- affects_checkin / affects_checkout let the innkeeper control whether the
-- calendar shows this as a hard boundary for guest check-in/out.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS block_type        TEXT
    CHECK (block_type IN ('maintenance', 'owner_block')),
  ADD COLUMN IF NOT EXISTS affects_checkin   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS affects_checkout  BOOLEAN NOT NULL DEFAULT true;

-- Index so calendar queries can quickly separate blocks from guest reservations
CREATE INDEX IF NOT EXISTS reservations_block_type_idx
  ON reservations (property_id, block_type)
  WHERE block_type IS NOT NULL;
