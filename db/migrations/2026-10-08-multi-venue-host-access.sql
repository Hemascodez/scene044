-- Membership is per real venue. Preserve every existing approval and booking.
ALTER TABLE venue_host_access DROP CONSTRAINT IF EXISTS venue_host_access_venue_slug_check;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'venue_host_access'::regclass
      AND conname = 'venue_host_access_venue_fk') THEN
    ALTER TABLE venue_host_access ADD CONSTRAINT venue_host_access_venue_fk
      FOREIGN KEY (venue_slug) REFERENCES venues(slug) NOT VALID;
  END IF;
  -- Bind each verified host login to ONE venue. Signing in elsewhere must not
  -- silently change permissions on another device. Backfill legacy sessions
  -- only when this column is first added, never on subsequent deployments.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'venue_user_sessions' AND column_name = 'host_venue_slug') THEN
    ALTER TABLE venue_user_sessions ADD COLUMN host_venue_slug TEXT;
    UPDATE venue_user_sessions s SET host_venue_slug = 'time-cafe'
      FROM venue_users u WHERE u.id = s.user_id AND u.role = 'Host' AND u.venue = 'Time Cafe'
      AND EXISTS (SELECT 1 FROM venue_host_access h WHERE h.venue_slug = 'time-cafe'
        AND h.phone_e164 = u.phone_e164 AND h.revoked_at IS NULL);
  END IF;
END $$;
