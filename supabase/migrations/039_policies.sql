-- 039_policies.sql
-- Policy text fields on properties + acceptance tracking table.

-- Add policy text columns to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS cancellation_policy_text TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS incidental_policy TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS marketing_policy TEXT;

-- Track what guests accepted during booking
CREATE TABLE IF NOT EXISTS policy_acceptances (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id    UUID REFERENCES reservations(id) ON DELETE SET NULL,
  guest_email       TEXT NOT NULL,
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address        TEXT,
  policies_accepted JSONB NOT NULL DEFAULT '[]'::jsonb
  -- Array of { type: 'terms'|'cancellation'|'incidental'|'marketing', accepted: boolean }
);

CREATE INDEX idx_policy_acceptances_property    ON policy_acceptances(property_id);
CREATE INDEX idx_policy_acceptances_reservation ON policy_acceptances(reservation_id);
CREATE INDEX idx_policy_acceptances_email       ON policy_acceptances(guest_email);

ALTER TABLE policy_acceptances ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY policy_acceptances_select ON policy_acceptances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = policy_acceptances.property_id
    )
  );

-- Public insert (guests accept during booking — no auth required)
CREATE POLICY policy_acceptances_insert ON policy_acceptances
  FOR INSERT WITH CHECK (true);
