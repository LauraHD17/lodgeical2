-- 013_contacts.sql
-- Admin contacts table for service providers, vendors, and emergency contacts.
-- Scoped per property via property_id.

CREATE TABLE IF NOT EXISTS contacts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Other',
  phone         TEXT,
  email         TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_property_id_idx ON contacts(property_id);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_admin_access ON contacts
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = contacts.property_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = contacts.property_id
    )
  );
