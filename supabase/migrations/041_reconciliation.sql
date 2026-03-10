-- 041_reconciliation.sql
-- Stripe reconciliation run history.

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  run_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_from   DATE NOT NULL,
  date_to     DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  summary     JSONB,
  details     JSONB
);

CREATE INDEX idx_reconciliation_property ON reconciliation_runs(property_id);

ALTER TABLE reconciliation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY reconciliation_select ON reconciliation_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = reconciliation_runs.property_id
    )
  );

CREATE POLICY reconciliation_insert ON reconciliation_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = reconciliation_runs.property_id
    )
  );
