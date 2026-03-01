-- Migration 002: rooms table
-- Rooms, cottages, suites — anything a guest can book at a property.

CREATE TABLE rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'room',  -- 'room', 'cottage', 'suite', etc.
  max_guests      INTEGER NOT NULL CHECK (max_guests >= 1),
  base_rate_cents INTEGER NOT NULL CHECK (base_rate_cents >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  description     TEXT,
  images          TEXT[],
  amenities       TEXT[],
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_property ON rooms(property_id);
