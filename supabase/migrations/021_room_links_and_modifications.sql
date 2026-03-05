-- Migration 021: Room linking, guest modification tracking, and misc fees
-- Supports: Feature 2 (misc fee), Feature 3 (guest modifications), Feature 4 (room links)

-- ── Room linking ──────────────────────────────────────────────────────────────

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS linkable BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS room_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  linked_room_ids UUID[] NOT NULL,
  base_rate_cents INTEGER NOT NULL,
  max_guests INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_links_property ON room_links(property_id);

ALTER TABLE room_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_room_links"
  ON room_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = room_links.property_id
    )
  );

CREATE POLICY "admin_insert_room_links"
  ON room_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = room_links.property_id
    )
  );

CREATE POLICY "admin_update_room_links"
  ON room_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = room_links.property_id
    )
  );

CREATE POLICY "admin_delete_room_links"
  ON room_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = room_links.property_id
    )
  );

-- Public read for widget (active links only)
CREATE POLICY "public_read_active_room_links"
  ON room_links FOR SELECT
  USING (is_active = true);

-- ── Guest modification tracking ───────────────────────────────────────────────

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS modification_count INTEGER DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS original_total_due_cents INTEGER;

-- ── Misc fee on reservations ──────────────────────────────────────────────────

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS misc_fee_cents INTEGER DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS misc_fee_label TEXT;
