-- Widen the stored duration without changing any existing booking. Public
-- pricing/form validation continues to accept only its existing whole hours.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venue_bookings'
      AND column_name = 'duration_hours' AND data_type = 'integer'
  ) THEN
    ALTER TABLE venue_bookings ALTER COLUMN duration_hours TYPE DOUBLE PRECISION
      USING duration_hours::double precision;
  END IF;
END $$;
COMMIT;
