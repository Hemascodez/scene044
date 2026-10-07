BEGIN;
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS archive_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_venue_bookings_active ON venue_bookings (venue_slug, event_date DESC, id DESC) WHERE archived_at IS NULL;
COMMIT;
-- Schema only. The owner-approved, exact pre-launch booking set is archived
-- separately by scripts/archive-prelaunch-bookings.ts after local verification.
