-- 037: Fix room color default from 'Sage' to 'Sage Green' (matches palette)
-- The original migration 034 used 'Sage' but the palette entry is 'Sage Green'.

UPDATE rooms SET color = 'Sage Green' WHERE color = 'Sage';
ALTER TABLE rooms ALTER COLUMN color SET DEFAULT 'Sage Green';
