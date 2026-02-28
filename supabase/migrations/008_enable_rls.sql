-- Migration 008: Enable Row Level Security on all tables
-- RLS is the enforcement layer — it runs inside PostgreSQL and CANNOT be bypassed
-- by application bugs. Enable it on every table without exception.

ALTER TABLE properties           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms                ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests               ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_property_access ENABLE ROW LEVEL SECURITY;
