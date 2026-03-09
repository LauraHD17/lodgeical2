-- Migration 028: Add payment_date and check_number to payments
-- payment_date allows recording when money was actually received (may differ from entry date).
-- check_number stores the check number for check payments.

ALTER TABLE payments ADD COLUMN payment_date DATE;
ALTER TABLE payments ADD COLUMN check_number TEXT;
