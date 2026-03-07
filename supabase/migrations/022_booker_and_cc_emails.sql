-- Migration 022: Booker email and CC emails for third-party bookings
-- Supports: Book-on-behalf feature (a booker books for a guest, with CC'd recipients)

-- Booker email: who made and paid for the booking (null = same as guest)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booker_email TEXT;

-- CC emails: additional recipients for check-in/arrival info (max 5, enforced in app)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cc_emails TEXT[] DEFAULT '{}';
