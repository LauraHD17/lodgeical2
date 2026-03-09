-- Add per-room buffer days (prep/turnover days before and after reservations)
ALTER TABLE rooms
  ADD COLUMN buffer_days_before INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN buffer_days_after  INTEGER NOT NULL DEFAULT 0;
