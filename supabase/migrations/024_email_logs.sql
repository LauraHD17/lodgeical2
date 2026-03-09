-- Migration 024: Email logs
-- Tracks all outbound emails sent by Edge Functions for the message center.

CREATE TABLE IF NOT EXISTS email_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id  UUID        REFERENCES reservations(id) ON DELETE SET NULL,
  guest_email     TEXT        NOT NULL,
  template_type   TEXT        NOT NULL,
  subject         TEXT        NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT        NOT NULL CHECK (status IN ('sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS email_logs_property_sent_idx
  ON email_logs (property_id, sent_at DESC);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view their property's email logs"
  ON email_logs FOR SELECT TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert email logs"
  ON email_logs FOR INSERT TO service_role
  WITH CHECK (true);
