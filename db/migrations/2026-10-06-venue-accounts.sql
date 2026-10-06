-- Additive venue-account rollout. Run against the same Neon database as
-- Railway DATABASE_URL before deploying the matching application code.
-- Re-runnable; does not delete or rewrite existing bookings.
BEGIN;

CREATE TABLE IF NOT EXISTS venue_users (
  id SERIAL PRIMARY KEY,
  phone_e164 TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'Organiser' CHECK (role IN ('Organiser', 'Host')),
  venue TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venue_user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES venue_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_user_sessions_user
  ON venue_user_sessions (user_id, expires_at DESC);

ALTER TABLE venue_bookings
  ADD COLUMN IF NOT EXISTS organizer_user_id INT REFERENCES venue_users(id);

CREATE INDEX IF NOT EXISTS idx_venue_bookings_organizer_user
  ON venue_bookings (organizer_user_id, created_at DESC);

ALTER TABLE venue_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_otp_verifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON venue_users, venue_user_sessions, phone_otp_verifications FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON venue_users, venue_user_sessions, phone_otp_verifications FROM authenticated';
  END IF;
END $$;

COMMIT;
