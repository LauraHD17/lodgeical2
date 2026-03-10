-- Migration 029: Onboarding state
-- Tracks which onboarding path a property chose and their progress through setup steps.

CREATE TABLE onboarding_state (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  onboarding_path text NOT NULL CHECK (onboarding_path IN ('migration', 'bridge', 'fresh')),
  completed_steps text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id)
);

ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own property onboarding"
  ON onboarding_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.property_id = onboarding_state.property_id
        AND upa.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own property onboarding"
  ON onboarding_state FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.property_id = onboarding_state.property_id
        AND upa.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own property onboarding"
  ON onboarding_state FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.property_id = onboarding_state.property_id
        AND upa.user_id = auth.uid()
    )
  );
