-- Migration 055: Import batch rollback
-- Adds rolled_back_at so the UI can show rollback state and disable re-rollback.
-- Also adds an UPDATE policy so the client can stamp rolled_back_at after deletion.

ALTER TABLE import_batches ADD COLUMN rolled_back_at timestamptz DEFAULT NULL;

CREATE POLICY "Users can update own property import batches"
  ON import_batches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access upa
      WHERE upa.property_id = import_batches.property_id
        AND upa.user_id = auth.uid()
    )
  );
