-- Additive/idempotent. Historical rejected items are intentionally NOT retried:
-- a source rejection, curator decision or old date must not be bulk-published.
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS lease_token text;
ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS discovery_items_retry_idx ON discovery_items(next_attempt_at, source_domain, id)
  WHERE status = 'auto_processing';
