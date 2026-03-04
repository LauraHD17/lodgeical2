-- 013_contacts.sql
-- Admin contacts table for vendors and staff.
-- Scoped per property via property_id.
-- type: 'vendor' | 'staff'

CREATE TABLE IF NOT EXISTS contacts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'vendor' CHECK (type IN ('vendor', 'staff')),
  first_name    TEXT,
  last_name     TEXT,
  company       TEXT,
  phone         TEXT,
  email         TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_property_id_idx ON contacts(property_id);
CREATE INDEX IF NOT EXISTS contacts_type_idx ON contacts(property_id, type);

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
