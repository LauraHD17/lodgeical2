-- Migration 049: Replace preset cancellation policy with custom tiers
-- Adds cancellation_tiers JSONB column to settings table.
-- Each tier: { "days_before": 30, "refund_percent": 100 }
-- Tiers are sorted by days_before descending. The last tier covers
-- all cancellations closer to check-in than the second-to-last tier.

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS cancellation_tiers JSONB;

-- Migrate existing preset policies to tiers
UPDATE settings SET cancellation_tiers = CASE cancellation_policy
  WHEN 'flexible' THEN '[{"days_before": 1, "refund_percent": 100}]'::jsonb
  WHEN 'moderate' THEN '[{"days_before": 5, "refund_percent": 100}, {"days_before": 0, "refund_percent": 0}]'::jsonb
  WHEN 'strict'   THEN '[{"days_before": 7, "refund_percent": 50}, {"days_before": 0, "refund_percent": 0}]'::jsonb
  ELSE '[{"days_before": 5, "refund_percent": 100}, {"days_before": 0, "refund_percent": 0}]'::jsonb
END
WHERE cancellation_tiers IS NULL;

-- Drop the old CHECK constraint and column (no longer needed)
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_cancellation_policy_check;
ALTER TABLE settings ALTER COLUMN cancellation_policy DROP NOT NULL;
ALTER TABLE settings ALTER COLUMN cancellation_policy SET DEFAULT NULL;
