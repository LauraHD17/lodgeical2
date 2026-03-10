-- 040_daily_digest.sql
-- Daily morning digest email toggle for properties.

ALTER TABLE properties ADD COLUMN IF NOT EXISTS daily_digest_enabled BOOLEAN NOT NULL DEFAULT false;
