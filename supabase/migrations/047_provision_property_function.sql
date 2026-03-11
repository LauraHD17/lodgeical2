-- Migration 047: provision_property() — SECURITY DEFINER function
-- Called by the frontend after signup to create property + settings + access row.
-- Bypasses RLS safely because it only creates resources for the calling user.

CREATE OR REPLACE FUNCTION public.provision_property(property_name TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_property_id UUID;
  v_slug TEXT;
BEGIN
  -- Get the calling user's ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a property
  IF EXISTS (SELECT 1 FROM user_property_access WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User already has a property';
  END IF;

  -- Generate a URL-safe slug from property name
  v_slug := lower(regexp_replace(trim(property_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(BOTH '-' FROM v_slug);
  -- Append random suffix to avoid collisions
  v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

  -- Create property
  INSERT INTO properties (name, slug)
  VALUES (property_name, v_slug)
  RETURNING id INTO v_property_id;

  -- Create default settings
  INSERT INTO settings (property_id)
  VALUES (v_property_id);

  -- Grant owner access
  INSERT INTO user_property_access (user_id, property_id, role)
  VALUES (v_user_id, v_property_id, 'owner');

  RETURN json_build_object(
    'property_id', v_property_id,
    'slug', v_slug
  );
END;
$$;
