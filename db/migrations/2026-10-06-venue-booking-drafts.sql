-- One in-progress request per organiser and venue. A submitted booking removes it.
-- Run after 2026-10-06-venue-accounts.sql. Safe to re-run.
BEGIN;

CREATE TABLE IF NOT EXISTS venue_booking_drafts (
  user_id INT NOT NULL REFERENCES venue_users(id) ON DELETE CASCADE,
  venue_slug TEXT NOT NULL,
  space_id TEXT NOT NULL,
  form_data JSONB NOT NULL,
  edited_at_ms BIGINT NOT NULL DEFAULT 0,
  submitted_at_ms BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, venue_slug)
);

ALTER TABLE venue_booking_drafts ADD COLUMN IF NOT EXISTS edited_at_ms BIGINT NOT NULL DEFAULT 0;
ALTER TABLE venue_booking_drafts ADD COLUMN IF NOT EXISTS submitted_at_ms BIGINT NOT NULL DEFAULT 0;

ALTER TABLE venue_booking_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON venue_booking_drafts FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON venue_booking_drafts FROM authenticated';
  END IF;
END $$;

COMMIT;
