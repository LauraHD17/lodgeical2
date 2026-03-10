-- Inquiries table: guest interest submissions from the booking widget
CREATE TABLE inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guest_first_name TEXT NOT NULL,
  guest_last_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  num_guests_range TEXT NOT NULL DEFAULT '1-2'
    CHECK (num_guests_range IN ('1-2', '3-4', '5-6', '7+')),
  room_ids UUID[],
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'contacted', 'converted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property members can view inquiries"
  ON inquiries FOR SELECT
  USING (property_id IN (
    SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
  ));

CREATE POLICY "Property members can update inquiries"
  ON inquiries FOR UPDATE
  USING (property_id IN (
    SELECT property_id FROM user_property_access WHERE user_id = auth.uid()
  ));

CREATE POLICY "Anyone can insert inquiries"
  ON inquiries FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_inquiries_property_id ON inquiries(property_id);
CREATE INDEX idx_inquiries_status ON inquiries(property_id, status);
CREATE INDEX idx_inquiries_created_at ON inquiries(property_id, created_at DESC);

-- Seasonal closure columns on properties table
ALTER TABLE properties
  ADD COLUMN seasonal_closure_start DATE,
  ADD COLUMN seasonal_closure_end DATE,
  ADD COLUMN seasonal_closure_message TEXT DEFAULT 'We haven''t opened these dates yet. Send an inquiry and we''ll reach out when availability opens up!';
