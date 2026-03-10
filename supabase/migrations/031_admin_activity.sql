-- Migration 031: Admin activity audit log
-- Tracks admin-initiated actions for audit trail.

CREATE TABLE IF NOT EXISTS admin_activity (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   UUID,
  details       JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_activity_property_created_idx
  ON admin_activity (property_id, created_at DESC);

ALTER TABLE admin_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view property audit log"
  ON admin_activity FOR SELECT TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert audit log"
  ON admin_activity FOR INSERT TO service_role
  WITH CHECK (true);
