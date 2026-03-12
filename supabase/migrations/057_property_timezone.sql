-- Migration 057: Add timezone to properties table
-- Used by scheduleMessages.ts to convert property-local send_time to UTC.
-- Defaults to America/New_York (covers majority of US inns).

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';
