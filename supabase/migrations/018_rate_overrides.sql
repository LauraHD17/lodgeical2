-- Migration 013: rate_overrides
-- Seasonal / date-range pricing on top of the room's base_rate_cents.
-- When a reservation falls within an override window, that rate is used instead.
-- If multiple overrides overlap the same dates, the one with the highest rate wins
-- (prevents accidental discount stacking).

CREATE TABLE IF NOT EXISTS rate_overrides (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id       UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  label         TEXT        NOT NULL DEFAULT 'Seasonal Rate',
  start_date    DATE        NOT NULL,
  end_date      DATE        NOT NULL,  -- inclusive
  rate_cents    INTEGER     NOT NULL CHECK (rate_cents >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rate_overrides_dates_valid CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS rate_overrides_room_dates_idx
  ON rate_overrides (room_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS rate_overrides_property_idx
  ON rate_overrides (property_id);

ALTER TABLE rate_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage their property's rate overrides"
  ON rate_overrides FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );
