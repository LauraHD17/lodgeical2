-- 058_email_logs_bounce_tracking.sql
-- Adds Resend email ID to email_logs for async bounce/delivery tracking via webhook.
-- Also expands the status column to allow 'bounced' and 'delivered'.

ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS resend_email_id TEXT;

-- Sparse index — most queries don't use this column; only the webhook lookup does
CREATE INDEX IF NOT EXISTS email_logs_resend_email_id_idx
  ON email_logs (resend_email_id)
  WHERE resend_email_id IS NOT NULL;

-- Expand status enum to include delivery events from Resend webhook
DO $$
BEGIN
  ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;
  ALTER TABLE email_logs ADD CONSTRAINT email_logs_status_check
    CHECK (status IN ('sent', 'failed', 'bounced', 'delivered'));
EXCEPTION WHEN others THEN
  NULL; -- constraint may not exist on this instance
END;
$$;
