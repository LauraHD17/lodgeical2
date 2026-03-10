-- Migration 030: Import batches
-- Tracks CSV import history so the transfer checklist can be regenerated later.

CREATE TABLE import_batches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  imported_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  reservation_ids uuid[] DEFAULT '{}',
  file_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own property import batches"
  ON import_batches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.property_id = import_batches.property_id
        AND upa.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own property import batches"
  ON import_batches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.property_id = import_batches.property_id
        AND upa.user_id = auth.uid()
    )
  );
