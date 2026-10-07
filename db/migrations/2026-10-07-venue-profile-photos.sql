BEGIN;
CREATE TABLE IF NOT EXISTS venue_user_photos (
  user_id INT PRIMARY KEY REFERENCES venue_users(id) ON DELETE CASCADE,
  bytes BYTEA NOT NULL CHECK (octet_length(bytes) BETWEEN 4 AND 524288),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE venue_user_photos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON venue_user_photos FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON venue_user_photos FROM authenticated;
  END IF;
END $$;
COMMIT;
