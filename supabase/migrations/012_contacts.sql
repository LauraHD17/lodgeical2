-- Migration 012: contacts table
-- Vendors and staff contacts. Staff contacts appear in Maintenance "Assigned To" dropdown.

CREATE TABLE contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('vendor', 'staff')),
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  company       TEXT,
  category      TEXT CHECK (category IN ('Cleaning','Plumbing','Electrical','HVAC','Landscaping','Pest Control','Internet','Other')),
  role          TEXT,
  access_level  TEXT CHECK (access_level IN ('owner', 'manager', 'staff')),
  phone         TEXT,
  email         TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_property_access" ON contacts
  USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "contacts_property_insert" ON contacts
  FOR INSERT WITH CHECK (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "contacts_property_update" ON contacts
  FOR UPDATE USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "contacts_property_delete" ON contacts
  FOR DELETE USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );
