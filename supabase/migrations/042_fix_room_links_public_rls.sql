-- Migration 042: Fix room_links public RLS policy
-- The existing "public_read_active_room_links" policy only checked is_active = true
-- with no property_id scoping — any anonymous caller could enumerate room links
-- (including pricing) for any property on the platform.
-- Fix: require the parent property to be both active and public, matching the
-- pattern used for rooms (migration 009).

DROP POLICY IF EXISTS "public_read_active_room_links" ON room_links;

CREATE POLICY "public_read_active_room_links"
  ON room_links FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = room_links.property_id
        AND properties.is_active = true
        AND properties.is_public = true
    )
  );
