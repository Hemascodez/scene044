-- One-time, scoped agreement. Never reprice saved bookings or overwrite later
-- host/curator edits. The customer pays the normal rate; commission is deducted.
UPDATE venue_spaces s
SET pricing_options = '{"minHours":2,"markupBasisPoints":0,"packages":[{"id":"six-hours","name":"Six-hour booking","hours":6,"basePrice":11000}]}'::jsonb,
    pricing_initialized = true, updated_at = now()
FROM venues v
WHERE s.venue_id = v.id AND v.slug = 'madras-adda'
  AND s.retired_at IS NULL AND s.community_rate = 2000
  AND s.pricing_options IS NULL AND NOT s.pricing_initialized;

-- User-confirmed uses, not invented equipment or a manually boosted score.
UPDATE venues SET summary =
  'Madras Adda is a cozy event space in Mylapore, Chennai, for intimate gatherings of 15–20 people. Host tech gatherings, social gatherings, book readings, art workshops, pottery events and discussion groups in a warm, thoughtfully designed room with Wi-Fi, air conditioning, a projector, speakers and lift access.',
  updated_at = now()
WHERE slug = 'madras-adda' AND summary =
  'Madras Adda is a cozy event space in Mylapore, Chennai, for intimate gatherings of 15–20 people. Host art events, workshops, book readings and community meetups in a warm, thoughtfully designed room with Wi-Fi, air conditioning, a projector, speakers and lift access.';
