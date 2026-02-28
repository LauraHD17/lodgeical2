-- Migration 004: reservations table
-- Core booking record. Supports multi-room stays.

CREATE TABLE reservations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id          UUID NOT NULL REFERENCES properties(id),
  guest_id             UUID NOT NULL REFERENCES guests(id),
  room_ids             UUID[] NOT NULL,  -- supports multi-room reservations
  check_in             DATE NOT NULL,
  check_out            DATE NOT NULL CHECK (check_out > check_in),
  num_guests           INTEGER NOT NULL CHECK (num_guests >= 1),
  status               TEXT NOT NULL DEFAULT 'confirmed'
                         CHECK (status IN ('confirmed','pending','cancelled','no_show')),
  origin               TEXT NOT NULL DEFAULT 'direct'
                         CHECK (origin IN ('direct','widget','import','phone')),
  total_due_cents      INTEGER NOT NULL CHECK (total_due_cents >= 0),
  is_tax_exempt        BOOLEAN NOT NULL DEFAULT false,
  confirmation_number  TEXT NOT NULL UNIQUE,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_property     ON reservations(property_id);
CREATE INDEX idx_reservations_guest        ON reservations(guest_id);
CREATE INDEX idx_reservations_dates        ON reservations(check_in, check_out);
CREATE INDEX idx_reservations_confirmation ON reservations(confirmation_number);
CREATE INDEX idx_reservations_status       ON reservations(property_id, status);

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
