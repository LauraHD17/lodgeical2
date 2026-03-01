-- Migration 011: External iCal feed sources per room
-- Stores URLs for external calendars (Airbnb, VRBO, etc.) that should be
-- synced into Lodge-ical as blocked dates. One feed per room.

CREATE TABLE room_external_feeds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  label           TEXT NOT NULL DEFAULT 'External Calendar',
  feed_url        TEXT NOT NULL,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id)   -- one external feed per room (simpler UX)
);

CREATE INDEX idx_external_feeds_room     ON room_external_feeds(room_id);
CREATE INDEX idx_external_feeds_property ON room_external_feeds(property_id);

ALTER TABLE room_external_feeds ENABLE ROW LEVEL SECURITY;

-- Property members can fully manage their external feeds
CREATE POLICY "Property members manage external feeds"
  ON room_external_feeds
  USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );
