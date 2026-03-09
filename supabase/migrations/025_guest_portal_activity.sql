-- Migration 025: Guest portal activity log
-- Tracks guest-initiated actions (modifications, contact updates, booker attachments)
-- for innkeeper audit trail on the dashboard.

CREATE TABLE IF NOT EXISTS guest_portal_activity (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id  UUID        REFERENCES reservations(id) ON DELETE SET NULL,
  guest_id        UUID        NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  action          TEXT        NOT NULL CHECK (action IN ('modification_confirmed', 'contact_updated', 'booker_attached')),
  details         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_portal_activity_property_created_idx
  ON guest_portal_activity (property_id, created_at DESC);

ALTER TABLE guest_portal_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view their property's guest activity"
  ON guest_portal_activity FOR SELECT TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert guest activity"
  ON guest_portal_activity FOR INSERT TO service_role
  WITH CHECK (true);
