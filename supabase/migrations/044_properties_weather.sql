-- Migration 014: add lat/lon to properties for weather widget
-- These are stored on the property record and read by the Dashboard WeatherStrip.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lon  DOUBLE PRECISION;
