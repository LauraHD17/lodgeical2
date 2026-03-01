-- Migration 003: guests table
-- Guest database. One record per email per property.

CREATE TABLE guests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  is_tax_exempt   BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,  -- internal admin notes only; never shown to guests
  tags            TEXT[], -- for filtering and organization
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, email)  -- one guest record per email per property
);

CREATE INDEX idx_guests_property ON guests(property_id);
CREATE INDEX idx_guests_email ON guests(property_id, email);
