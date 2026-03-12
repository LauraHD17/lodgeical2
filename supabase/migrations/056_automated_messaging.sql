-- Migration 056: Automated messaging rules + scheduled message queue
-- Adds rule config columns to email_templates and creates the scheduled_messages queue.

-- Step 1: Expand template_type CHECK constraint to include 3 new timed types
ALTER TABLE email_templates DROP CONSTRAINT email_templates_template_type_check;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_template_type_check
  CHECK (template_type IN (
    'booking_confirmation',
    'cancellation_notice',
    'modification_confirmation',
    'payment_failed',
    'check_in_reminder',
    'check_out_reminder',
    'custom',
    'pre_arrival_info',
    'post_stay_follow_up',
    'booking_thank_you_delay'
  ));

-- Step 2: Add scheduling rule columns to email_templates
-- rule_enabled: whether this template auto-sends on new reservations
-- trigger_event: what event anchors the send time
-- offset_days: days before/after the anchor event
-- send_time: time of day in property local time (e.g. '10:00:00')
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS rule_enabled   BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trigger_event  TEXT
    CHECK (trigger_event IN ('after_booking', 'before_check_in', 'after_check_out')),
  ADD COLUMN IF NOT EXISTS offset_days    INTEGER,
  ADD COLUMN IF NOT EXISTS send_time      TIME;

-- Step 3: Add gmail_thread_id to email_logs for future Phase 2 Gmail two-way sync
-- Nullable — only populated once Gmail integration is implemented.
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;

-- Step 4: Create scheduled_messages queue table
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id  UUID        NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  template_type   TEXT        NOT NULL,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  cancelled_by    TEXT
    CHECK (cancelled_by IN ('innkeeper', 'system')),
  cancelled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial index for efficient pending message lookup (the hot path)
CREATE INDEX IF NOT EXISTS scheduled_messages_pending_idx
  ON scheduled_messages (scheduled_for)
  WHERE status = 'pending';

-- Index for per-reservation queries (reservation drawer UI)
CREATE INDEX IF NOT EXISTS scheduled_messages_reservation_idx
  ON scheduled_messages (reservation_id);

-- Step 5: Enable RLS
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Staff can view and cancel their property's scheduled messages
CREATE POLICY "Staff can access their property scheduled messages"
  ON scheduled_messages FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );

-- Service role (Edge Functions) can insert, update, delete
CREATE POLICY "Service role manages scheduled messages"
  ON scheduled_messages FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
