-- 038_documents.sql
-- Document uploads linked to guests and/or reservations.
-- Admin-only access (not guest-facing).

CREATE TABLE IF NOT EXISTS documents (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id    UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_id       UUID REFERENCES guests(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  filename       TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  file_url       TEXT,
  file_size      INTEGER,
  mime_type      TEXT,
  uploaded_by    UUID,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_property    ON documents(property_id);
CREATE INDEX idx_documents_guest       ON documents(guest_id);
CREATE INDEX idx_documents_reservation ON documents(reservation_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Admin access only: users with property access can read/write
CREATE POLICY documents_select ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = documents.property_id
    )
  );

CREATE POLICY documents_insert ON documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = documents.property_id
    )
  );

CREATE POLICY documents_delete ON documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = documents.property_id
    )
  );
