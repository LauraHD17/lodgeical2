-- Migration 014: email_templates
-- Per-property, per-type email templates with {{variable}} interpolation.
-- Types: booking_confirmation, cancellation_notice, payment_failed,
--        check_in_reminder, check_out_reminder
--
-- Variable tags available in templates:
--   {{guest_first_name}}, {{guest_last_name}}, {{guest_email}}
--   {{confirmation_number}}, {{check_in_date}}, {{check_out_date}},
--   {{room_names}}, {{num_nights}}, {{total_due}}, {{balance_due}},
--   {{property_name}}, {{check_in_time}}, {{check_out_time}},
--   {{cancellation_policy}}, {{refund_amount}}

CREATE TABLE IF NOT EXISTS email_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  template_type   TEXT        NOT NULL
                    CHECK (template_type IN (
                      'booking_confirmation',
                      'cancellation_notice',
                      'payment_failed',
                      'check_in_reminder',
                      'check_out_reminder'
                    )),
  subject         TEXT        NOT NULL,
  body_html       TEXT        NOT NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (property_id, template_type)
);

CREATE INDEX IF NOT EXISTS email_templates_property_type_idx
  ON email_templates (property_id, template_type);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage their property's email templates"
  ON email_templates FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
    )
  );
