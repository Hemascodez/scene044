-- Chennai Event Discovery MVP schema
-- Run this once against your Postgres database (Neon/Supabase) before seeding.

CREATE TABLE IF NOT EXISTS sources (
  id SERIAL PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  trust_tier TEXT NOT NULL DEFAULT 'curator_only', -- 'auto_fetch' | 'curator_only' | 'blocked'
  robots_allowed BOOLEAN,
  robots_checked_at TIMESTAMPTZ,
  rate_limit_per_hour INT DEFAULT 30,
  last_fetched_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS search_queries (
  id SERIAL PRIMARY KEY,
  query_text TEXT NOT NULL,          -- e.g. 'Chennai AI meetup'
  category_hint TEXT,                -- e.g. 'ai'
  site_filter TEXT,                  -- e.g. 'site:lu.ma' or NULL
  active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  UNIQUE (query_text, site_filter)
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  category TEXT NOT NULL,            -- ai | tech | cybersecurity | marketing | product | design | startups | finance | data
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT false,
  venue_name TEXT,
  venue_address TEXT,
  city TEXT DEFAULT 'Chennai',
  organizer_name TEXT,
  poster_image_url TEXT,
  price_type TEXT,                   -- 'free' | 'paid' | NULL. NULL means UNKNOWN,
                                     -- never "assume free": the absence of a
                                     -- schema.org offers block tells us nothing
                                     -- about whether a ticket is required.
  price_note TEXT,                   -- verbatim display amount, e.g. '₹499'
  primary_source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,         -- 'auto' | 'curator'
  chennai_relevance_score NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review | live | updated | postponed | cancelled | expired | stale
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discovery_items (            -- every raw search hit; nothing is ever deleted
  id SERIAL PRIMARY KEY,
  query_id INT REFERENCES search_queries(id),
  title TEXT,
  snippet TEXT,
  url TEXT NOT NULL UNIQUE,
  source_domain TEXT NOT NULL,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new',   -- new | auto_processing | auto_extracted |
                                         -- curator_pending | needs_correction |
                                         -- curator_approved | curator_rejected |
                                         -- rejected | duplicate | stale | error
  rejection_reason TEXT,
  event_id INT REFERENCES events(id),
  extraction_meta JSONB              -- {sourceMethod, confidence, dateEvidence, venueEvidence, possibleDuplicate}
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS price_type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS price_note TEXT;

-- Idempotent for DBs created before these columns existed.
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS extraction_meta JSONB;

-- A curator's in-progress edit, so "save for later" survives a reload or a
-- handover to another curator. Server-side rather than localStorage because the
-- queue is shared: a draft stuck in one person's browser is a draft nobody else
-- can finish.
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS curator_draft JSONB;
ALTER TABLE discovery_items ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'search'; -- 'search' | 'curator' | 'community'

CREATE TABLE IF NOT EXISTS event_sources (            -- dedup links + "also listed on" badge
  id SERIAL PRIMARY KEY,
  event_id INT REFERENCES events(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  discovery_item_id INT REFERENCES discovery_items(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, source_url)
);

-- Visitor-submitted corrections. Kept in its own table so a report is never
-- lost: flagging discovery_items only works for events that came through the
-- discovery pipeline, and curator-entered events have no discovery_item to
-- flag. Deliberately does NOT mutate events.status — this endpoint is
-- unauthenticated, so letting it change what the public feed shows would hand
-- anyone the ability to mark every event cancelled.
CREATE TABLE IF NOT EXISTS event_reports (
  id SERIAL PRIMARY KEY,
  event_id INT REFERENCES events(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  reported_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_event_reports_unresolved ON event_reports(event_id) WHERE resolved_at IS NULL;

-- Self-hosted event posters.
--
-- Bytes live in Postgres rather than object storage on purpose: it needs no new
-- credentials or provider, works identically locally and on Vercel, and the
-- volume is tiny (a curated city feed, a few hundred KB per poster). If this
-- ever grows past a few thousand posters, move the bytes to blob storage and
-- keep this table as the metadata index.
--
-- Re-hosting rather than hotlinking matters for two reasons: source poster URLs
-- rot (and then every card silently loses its image), and hotlinking leaks each
-- visitor's IP and referrer to whichever CDN the organizer happened to use.
CREATE TABLE IF NOT EXISTS poster_uploads (
  id SERIAL PRIMARY KEY,
  mime TEXT NOT NULL,                -- verified from magic bytes, never from the client
  bytes BYTEA NOT NULL,
  byte_size INT NOT NULL,
  origin TEXT NOT NULL,              -- 'upload' | 'import' | 'auto'
  origin_url TEXT,                   -- where it was imported/auto-fetched from
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clicks (
  id SERIAL PRIMARY KEY,
  event_id INT REFERENCES events(id),
  clicked_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_items_status ON discovery_items(status);
CREATE INDEX IF NOT EXISTS idx_events_status_start_at ON events(status, start_at);
CREATE INDEX IF NOT EXISTS idx_event_sources_event_id ON event_sources(event_id);
