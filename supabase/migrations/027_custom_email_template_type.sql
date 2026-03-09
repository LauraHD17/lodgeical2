-- Migration 027: Add custom email template type
-- Allows properties to create a fully customizable blank email template.

ALTER TABLE email_templates DROP CONSTRAINT email_templates_template_type_check;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_template_type_check
  CHECK (template_type IN (
    'booking_confirmation',
    'cancellation_notice',
    'modification_confirmation',
    'payment_failed',
    'check_in_reminder',
    'check_out_reminder',
    'custom'
  ));
