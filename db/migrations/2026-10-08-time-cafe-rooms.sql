-- One-time correction of the legacy catalog to the owner's approved four rooms.
-- Repeated deploys must NEVER reset subsequent host/curator edits. Save the old
-- catalog for recovery; booking/payment rows and venue gallery are untouched.
ALTER TABLE venue_spaces ADD COLUMN IF NOT EXISTS retired_at timestamptz;
CREATE TABLE IF NOT EXISTS venue_catalog_content_updates (
  key text PRIMARY KEY,
  previous_spaces jsonb NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE venue_catalog_content_updates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE cafe_id integer;
BEGIN
  SELECT id INTO cafe_id FROM venues WHERE slug = 'time-cafe' FOR UPDATE;
  IF cafe_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM venue_catalog_content_updates WHERE key = 'time-cafe-approved-rooms-2026-10-08') THEN RETURN; END IF;

  INSERT INTO venue_catalog_content_updates(key, previous_spaces)
  SELECT 'time-cafe-approved-rooms-2026-10-08', coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    FROM venue_spaces s WHERE venue_id = cafe_id;

  INSERT INTO venue_spaces AS current_room
    (venue_id, space_key, name, eyebrow, description, capacity, max_guests, image,
     amenities, community_rate, production_rate, minimum_food_spend, sort_order)
  VALUES
    (cafe_id, 'first-floor', 'First-floor event space', 'Best for meetups',
     'A flexible indoor floor for talks, workshops, recordings, and professional gatherings.',
     '25–30 people', 30, '/venues/figma/spaces-f33c5.jpg',
     ARRAY['Projector','Strong wifi','Flexible tables','Indoor','Power access'], 2000, 2000, NULL, 0),
    (cafe_id, 'korean-table', 'Korean table', 'Best for evenings',
     'A low, communal Korean-style table for shared meals, tastings, and relaxed evening sessions.',
     'Up to 8 people', 8, '/venues/figma/spaces-86081.jpg',
     ARRAY['8 seats','Low seating','Cafe service'], 1000, 1000, NULL, 1),
    (cafe_id, 'standard-table', 'Conversation table', 'For a small circle',
     'A dedicated table for mentoring, interviews, and focused small-group conversations.',
     'Up to 4 people', 4, '/venues/figma/spaces-d5006.jpg',
     ARRAY['4 seats','Cafe service','Power nearby'], 400, 400, NULL, 2),
    (cafe_id, 'terrace', 'Open terrace · BBQ table', 'Under the sky',
     'A rooftop terrace with a built-in BBQ grill, string lights, and Chennai skyline views — best for sundowners and casual evening cookouts.',
     'Up to 16 people', 16, '/venues/time-cafe/terrace.jpeg',
     ARRAY['Open air','BBQ grill','String lights'], 1500, 1500, NULL, 3)
  ON CONFLICT (venue_id, space_key) DO UPDATE SET
    name = EXCLUDED.name, eyebrow = EXCLUDED.eyebrow, description = EXCLUDED.description,
    capacity = EXCLUDED.capacity, max_guests = EXCLUDED.max_guests,
    -- Replace ONLY the known seed photos. Host uploads / external photos stay.
    image = CASE WHEN current_room.image IS NULL OR current_room.image = ''
      OR current_room.image IN ('/venues/time-cafe/first-floor-wide.jpeg',
        '/venues/time-cafe/terrace.jpeg', '/venues/time-cafe/small-table.jpeg')
      THEN EXCLUDED.image ELSE current_room.image END,
    community_rate = EXCLUDED.community_rate, production_rate = EXCLUDED.production_rate,
    minimum_food_spend = EXCLUDED.minimum_food_spend, sort_order = EXCLUDED.sort_order,
    retired_at = NULL, updated_at = now();

  -- The old three-person mock option is no longer bookable. Retain the row and
  -- every old booking's room name, charged price, payment and check-in history.
  UPDATE venue_spaces SET retired_at = coalesce(retired_at, now())
    WHERE venue_id = cafe_id AND space_key = 'small-table';
END $$;
