-- Migration 009: Row Level Security policies
-- Two tiers per table:
--   1. Admin policy: users with an entry in user_property_access can read/write their property's rows.
--   2. Public policy (where applicable): is_active + is_public allows anonymous read for widget.

-- ─── Helper: check if current user has access to a property ─────────────────
-- Used in policies below. Inline for performance (avoids function call overhead).


-- ─── properties ─────────────────────────────────────────────────────────────

-- Admins can read/write their own property
CREATE POLICY "admin_read_own_property"
  ON properties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = properties.id
    )
  );

CREATE POLICY "admin_update_own_property"
  ON properties FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = properties.id
    )
  );

-- Public: active + public properties readable by anyone (widget)
CREATE POLICY "public_read_active_property"
  ON properties FOR SELECT
  USING (is_active = true AND is_public = true);


-- ─── rooms ──────────────────────────────────────────────────────────────────

CREATE POLICY "admin_access_rooms"
  ON rooms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = rooms.property_id
    )
  );

-- Public: anyone can read active rooms for a public, active property (widget)
CREATE POLICY "public_read_active_rooms"
  ON rooms FOR SELECT
  USING (
    rooms.is_active = true
    AND EXISTS (
      SELECT 1 FROM properties
      WHERE id = rooms.property_id
        AND is_active = true
        AND is_public = true
    )
  );


-- ─── guests ─────────────────────────────────────────────────────────────────

CREATE POLICY "admin_access_guests"
  ON guests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = guests.property_id
    )
  );


-- ─── reservations ───────────────────────────────────────────────────────────

CREATE POLICY "admin_access_reservations"
  ON reservations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = reservations.property_id
    )
  );


-- ─── payments ───────────────────────────────────────────────────────────────

CREATE POLICY "admin_access_payments"
  ON payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = payments.property_id
    )
  );


-- ─── settings ───────────────────────────────────────────────────────────────

CREATE POLICY "admin_access_settings"
  ON settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access
      WHERE user_id = auth.uid()
        AND property_id = settings.property_id
    )
  );

-- Public: limited settings readable for widget (check_in_time, check_out_time, tax_rate, etc.)
-- NOTE: stripe_account_id and stripe_publishable_key are stripped at the Edge Function layer
CREATE POLICY "public_read_active_settings"
  ON settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE id = settings.property_id
        AND is_active = true
        AND is_public = true
    )
  );


-- ─── user_property_access ───────────────────────────────────────────────────

-- Users can read their own access records
CREATE POLICY "user_read_own_access"
  ON user_property_access FOR SELECT
  USING (user_id = auth.uid());

-- Owners can manage access for their property
CREATE POLICY "owner_manage_access"
  ON user_property_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_property_access upa2
      WHERE upa2.user_id = auth.uid()
        AND upa2.property_id = user_property_access.property_id
        AND upa2.role = 'owner'
    )
  );
