-- Migration 013: maintenance_tickets table
-- Internal tool for logging room problems, repairs, and cleaning tasks.
-- Urgent tickets surface on the Dashboard and Calendar.

CREATE TABLE maintenance_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'Other'
                    CHECK (category IN ('Plumbing','Electrical','HVAC','Cleaning','Furniture','Appliance','Exterior','Other')),
  priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('urgent','high','medium','low')),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','resolved')),
  assigned_to     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  blocks_booking  BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_maintenance_tickets_updated_at
  BEFORE UPDATE ON maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_property_access" ON maintenance_tickets
  USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "maintenance_property_insert" ON maintenance_tickets
  FOR INSERT WITH CHECK (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "maintenance_property_update" ON maintenance_tickets
  FOR UPDATE USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "maintenance_property_delete" ON maintenance_tickets
  FOR DELETE USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );
