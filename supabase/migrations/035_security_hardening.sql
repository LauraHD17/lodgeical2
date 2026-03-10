-- Migration 035: Security hardening
-- Fixes room_photos overly permissive public policy and
-- tightens inquiries insert policy (defense-in-depth).

-- 1. Replace room_photos public read policy with property-scoped check
DROP POLICY IF EXISTS room_photos_public_read ON room_photos;

CREATE POLICY room_photos_public_read ON room_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rooms r
      INNER JOIN properties p ON p.id = r.property_id
      WHERE r.id = room_photos.room_id
        AND p.is_active = true
        AND p.is_public = true
    )
  );

-- 2. Replace overly permissive inquiries insert policy
--    Validates property_id exists and property is public
DROP POLICY IF EXISTS "Anyone can insert inquiries" ON inquiries;

CREATE POLICY "Anyone can insert inquiries for public properties"
  ON inquiries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = inquiries.property_id
        AND p.is_active = true
        AND p.is_public = true
    )
  );
