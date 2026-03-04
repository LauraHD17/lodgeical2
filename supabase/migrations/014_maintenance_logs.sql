-- 014_maintenance_logs.sql
-- Maintenance log table — chronological record of completed work.
-- Not a ticket system: logs what was done, when, and by whom.
-- Optional reminder date surfaces a badge on the dashboard.

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id             UUID REFERENCES rooms(id) ON DELETE SET NULL,
  completed_date      DATE NOT NULL,
  category            TEXT NOT NULL DEFAULT 'General',
  description         TEXT NOT NULL,
  performed_by        TEXT,
  cost_cents          INT,
  next_reminder_date  DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_logs_property_id_idx ON maintenance_logs(property_id);
CREATE INDEX IF NOT EXISTS maintenance_logs_reminder_idx    ON maintenance_logs(next_reminder_date) WHERE next_reminder_date IS NOT NULL;

ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY maintenance_logs_admin_access ON maintenance_logs
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = maintenance_logs.property_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = maintenance_logs.property_id
    )
  );
