-- Migration 010: Add iCal token to rooms for authenticated feed access
-- Each room gets a stable, unique token used as the secret in its iCal feed URL.
-- No auth required to read the feed — the token IS the credential.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS ical_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;

CREATE INDEX IF NOT EXISTS idx_rooms_ical_token ON rooms(ical_token);

COMMENT ON COLUMN rooms.ical_token IS
  'Stable secret token used in the public iCal feed URL for this room. '
  'Rotating this token immediately invalidates subscribed calendars.';
