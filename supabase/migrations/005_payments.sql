-- Migration 005: payments table
-- Payment records for all charges and refunds.
-- Both Stripe and manual payments live here.

CREATE TABLE payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id            UUID NOT NULL REFERENCES reservations(id),
  property_id               UUID NOT NULL REFERENCES properties(id),
  type                      TEXT NOT NULL CHECK (type IN ('charge', 'refund')),
  amount_cents              INTEGER NOT NULL CHECK (amount_cents > 0),
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('succeeded','pending','failed','requires_action')),
  method                    TEXT NOT NULL CHECK (method IN ('stripe','manual','cash','check')),
  stripe_payment_intent_id  TEXT,  -- set for Stripe payments
  stripe_charge_id          TEXT,  -- set after webhook confirmation
  notes                     TEXT,  -- required when method != stripe
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_reservation ON payments(reservation_id);
CREATE INDEX idx_payments_property    ON payments(property_id);
CREATE INDEX idx_payments_stripe_pi   ON payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
