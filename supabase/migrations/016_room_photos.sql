-- 016_room_photos.sql
-- Per-room photo records. Files stored in Supabase Storage bucket "room-photos".
-- sort_order controls display sequence (drag-to-reorder).

CREATE TABLE IF NOT EXISTS room_photos (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  sort_order   INT  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_photos_room_id_idx ON room_photos(room_id);

ALTER TABLE room_photos ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with their property's photos
CREATE POLICY room_photos_admin_access ON room_photos
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = room_photos.property_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = room_photos.property_id
    )
  );

-- Public can read photos (needed for booking widget display)
CREATE POLICY room_photos_public_read ON room_photos
  FOR SELECT USING (true);
