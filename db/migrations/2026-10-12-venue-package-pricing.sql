-- Additive only: historical prices and payments are never repriced.
ALTER TABLE venue_spaces ADD COLUMN IF NOT EXISTS pricing_options JSONB;
ALTER TABLE venue_spaces ADD COLUMN IF NOT EXISTS pricing_initialized BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS package_id TEXT;
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS package_name TEXT;
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS host_amount INT;
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS scene_amount INT;
ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS pricing_model TEXT;

-- Initialise the owner's agreed packages once. Later curator edits survive deploys.
UPDATE venue_spaces s SET pricing_options = COALESCE(s.pricing_options, '{"minHours":2,"markupBasisPoints":1000,"packages":[{"id":"half-day","name":"Half-day","hours":4,"basePrice":7000},{"id":"full-day","name":"Full-day","hours":8,"basePrice":12000}]}'::jsonb), pricing_initialized = true,
  updated_at = now()
FROM venues v WHERE s.venue_id = v.id AND v.slug = 'chennai-yoga-studio'
  AND s.space_key = 'yoga-wellness-studio' AND NOT s.pricing_initialized;
