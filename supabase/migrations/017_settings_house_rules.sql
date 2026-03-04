-- Migration 017: add house_rules to settings
-- Newline-separated list of house rules shown on the guest check-in page.
-- Each line becomes a bullet point. Leave NULL to show nothing.

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS house_rules TEXT DEFAULT NULL;
