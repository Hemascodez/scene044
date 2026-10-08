-- Albums support real host-created spaces. Existing booking snapshots are untouched.
ALTER TABLE venue_spaces ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}';
DO $$
BEGIN
  PERFORM id FROM venues WHERE slug='time-cafe' FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM venue_catalog_content_updates WHERE key='time-cafe-bbq-one-hour-2026-10-08') THEN
    INSERT INTO venue_catalog_content_updates(key,previous_spaces)
      SELECT 'time-cafe-bbq-one-hour-2026-10-08', COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
      FROM venue_spaces s JOIN venues v ON v.id=s.venue_id WHERE v.slug='time-cafe';
    UPDATE venue_spaces SET name='BBQ table', image='/venues/time-cafe/bbq-table.png',
      photos=ARRAY['/venues/time-cafe/bbq-table.png','/venues/time-cafe/bbq-table-views.png'],updated_at=now()
      WHERE space_key='terrace' AND venue_id=(SELECT id FROM venues WHERE slug='time-cafe');
    UPDATE venues SET policies=ARRAY(SELECT CASE WHEN rule ~* '^([134])-hour minimum booking' THEN '1-hour minimum booking.' ELSE rule END FROM unnest(policies) rule),updated_at=now()
      WHERE slug='time-cafe';
  END IF;
END $$;
