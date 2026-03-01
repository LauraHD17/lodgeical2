-- Migration 007: user_property_access table
-- Links Supabase Auth users to properties with a role.
-- This is the authorization layer for all admin users.

CREATE TABLE user_property_access (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'staff'
                CHECK (role IN ('owner', 'manager', 'staff')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)  -- one role per user per property
);

CREATE INDEX idx_upa_user     ON user_property_access(user_id);
CREATE INDEX idx_upa_property ON user_property_access(property_id);
