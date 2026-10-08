-- No phone is auto-approved: use Curator → Venues → Host access.
CREATE TABLE IF NOT EXISTS venue_host_access (
  id SERIAL PRIMARY KEY,
  venue_slug TEXT NOT NULL CHECK (venue_slug = 'time-cafe'),
  phone_e164 TEXT NOT NULL CHECK (phone_e164 ~ '^91[6-9][0-9]{9}$'),
  label TEXT NOT NULL DEFAULT '',
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (venue_slug, phone_e164)
);
ALTER TABLE venue_host_access ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON venue_host_access FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON venue_host_access FROM authenticated; END IF;
END $$;
