-- Migration 048: Fix infinite recursion in user_property_access RLS policy
-- The owner_manage_access policy queries user_property_access to check ownership,
-- which triggers the same policy, causing infinite recursion.
-- Fix: use a SECURITY DEFINER function to bypass RLS for the ownership check.

CREATE OR REPLACE FUNCTION public.is_property_owner(p_user_id UUID, p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_property_access
    WHERE user_id = p_user_id
      AND property_id = p_property_id
      AND role = 'owner'
  );
$$;

-- Drop the recursive policy and replace with one using the helper function
DROP POLICY IF EXISTS "owner_manage_access" ON user_property_access;

CREATE POLICY "owner_manage_access"
  ON user_property_access FOR ALL
  USING (
    public.is_property_owner(auth.uid(), property_id)
  );
