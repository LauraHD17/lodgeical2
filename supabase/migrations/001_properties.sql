-- Migration 001: properties table
-- Core property record. Slug is used in widget URLs.

CREATE TABLE properties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,   -- used in widget URLs, safe to expose
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_public     BOOLEAN NOT NULL DEFAULT true, -- gates public widget access
  timezone      TEXT NOT NULL DEFAULT 'America/New_York',
  location      TEXT,
  images        TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
