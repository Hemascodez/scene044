-- Additive/idempotent. Historical rejected items are intentionally NOT retried:
-- a source rejection, curator decision or old date must not be bulk-published.
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS lease_token text;
ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 0;
-- Hints for scheduling only. These are never evidence for events.city.
ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS discovery_market text;
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS discovery_market text;
UPDATE discovery_items di SET discovery_market = sq.discovery_market
  FROM search_queries sq
 WHERE di.query_id = sq.id AND di.discovery_market IS NULL AND sq.discovery_market IS NOT NULL;
UPDATE discovery_items SET discovery_market = CASE url
  WHEN 'https://luma.com/bengaluru' THEN 'Bengaluru'
  WHEN 'https://luma.com/mumbai' THEN 'Mumbai'
  WHEN 'https://luma.com/new-delhi' THEN 'Delhi' END
 WHERE discovery_market IS NULL AND url IN
  ('https://luma.com/bengaluru', 'https://luma.com/mumbai', 'https://luma.com/new-delhi');
CREATE INDEX IF NOT EXISTS discovery_items_market_idx ON discovery_items(discovery_market, last_attempt_at, id)
  WHERE status = 'auto_processing';
CREATE INDEX IF NOT EXISTS discovery_items_retry_idx ON discovery_items(next_attempt_at, source_domain, id)
  WHERE status = 'auto_processing';
