-- SCENE/044 — full Supabase setup.
-- Paste into the Supabase SQL Editor (Database > SQL Editor > New query) and Run.
-- Safe to re-run: every statement is idempotent.

-- ============================ SCHEMA ============================
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
                                         -- rejected | duplicate | stale | error |
                                         -- expanded
                                         --
                                         -- 'expanded' = the URL was a listing page
                                         -- (Eventbrite city feed, Lu.ma calendar). It is
                                         -- not an event itself; each event it advertised
                                         -- was inserted as its own discovery_item. Kept
                                         -- distinct from 'rejected' so the pipeline can
                                         -- tell "this page was useful" from "this page
                                         -- was junk".
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

-- ============================================================================
-- Subscribers
-- ============================================================================
--
-- Deliberately separate from `events`: this is the only table in the database
-- holding personal data, and keeping it apart means the public read path
-- (lib/events.ts) can never accidentally join against it.
--
-- There is no verification step by product decision — no OTP, no double
-- opt-in email. Consent is captured differently per channel:
--
--   email    — the visitor typed their address into the signup field. The
--              row is created immediately with status 'active'.
--   whatsapp — the visitor sent US a message first, via a wa.me link. That
--              user-initiated inbound message IS the opt-in Meta requires,
--              and it opens a 24-hour free service window. We therefore never
--              collect a phone number through a form: a number typed into a
--              field is NOT a valid opt-in, and messaging it would be
--              unsolicited. WhatsApp rows can only be created from an inbound
--              message webhook (see lib/subscribers.ts -> recordWhatsappOptIn).
CREATE TABLE IF NOT EXISTS subscribers (
  id SERIAL PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),

  -- Exactly one identifier is populated, matching `channel`.
  email TEXT,
  phone_e164 TEXT,                   -- E.164, digits only after '+', e.g. +919876543210
  name TEXT,                         -- parsed from the user-initiated WhatsApp message
  role TEXT,
  message TEXT,                      -- original/latest inbound opt-in message

  -- Empty array means "everything" rather than "nothing" — a subscriber who
  -- ticks no boxes wants the whole feed, which is the common case.
  categories TEXT[] NOT NULL DEFAULT '{}',

  status TEXT NOT NULL DEFAULT 'active',  -- active | unsubscribed | bounced | blocked

  -- Opaque, unguessable, and unique per subscriber. Used for one-click
  -- unsubscribe links, which every bulk email must carry (CAN-SPAM, GDPR, and
  -- Gmail/Yahoo's 2024 bulk-sender rules all require it). Generated with a
  -- CSPRNG, never derived from the email address.
  unsubscribe_token TEXT NOT NULL UNIQUE,

  -- Provenance for consent disputes: where the signup happened and what the
  -- visitor was shown when they consented.
  source TEXT NOT NULL DEFAULT 'web',
  consent_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,

  -- One row per address/number. Partial unique indexes rather than a plain
  -- UNIQUE so that the unused column being NULL doesn't defeat uniqueness.
  CONSTRAINT subscribers_identifier_matches_channel CHECK (
    (channel = 'email'    AND email IS NOT NULL AND phone_e164 IS NULL) OR
    (channel = 'whatsapp' AND phone_e164 IS NOT NULL AND email IS NULL)
  )
);

-- Idempotent for databases created before WhatsApp profile details were kept.
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS message TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_phone ON subscribers(phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(channel) WHERE status = 'active';

/*
 * Row Level Security.
 *
 * RLS is enabled with NO policies, which in Postgres means: any role subject
 * to RLS can see and do nothing. That is the intended posture — Supabase's
 * `anon` and `authenticated` roles reach the database through PostgREST, and
 * this table must be invisible to both. Adding a policy later is a deliberate
 * act; the default is closed.
 *
 * IMPORTANT, and easy to get wrong: this app does NOT talk to Supabase through
 * PostgREST. It connects directly with `pg` (lib/db.ts) using DATABASE_URL. If
 * that connection string is the postgres superuser or the table owner, it
 * BYPASSES RLS entirely — RLS is not what protects these rows from our own
 * application code. It is defence-in-depth against the anon key leaking or
 * PostgREST being exposed, which is a real and common failure mode.
 *
 * FORCE ROW LEVEL SECURITY is deliberately NOT set: forcing it would apply RLS
 * to the table owner too and lock out our own writes.
 */
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- Belt and braces: even if RLS were later disabled by accident, these roles
-- hold no grants on the table. DO block so this stays runnable on a plain
-- Postgres where the Supabase roles don't exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON subscribers FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON subscribers FROM authenticated';
  END IF;
END $$;

-- Append-only log of what was sent to whom. Kept separate from `subscribers`
-- so a send failure never mutates consent state, and so per-message cost can
-- be reconciled against the provider's own billing (WhatsApp marketing
-- templates are billed per message by Meta, ~Rs 0.86 on the India rate).
CREATE TABLE IF NOT EXISTS subscriber_sends (
  id SERIAL PRIMARY KEY,
  subscriber_id INT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  template_name TEXT,                -- Meta-approved template, for WhatsApp
  provider TEXT,                     -- 'meta' | email provider, once chosen
  provider_message_id TEXT,
  campaign_key TEXT,                 -- e.g. whatsapp-weekly:2026-09-07
  event_ids INT[] NOT NULL DEFAULT '{}',
  template_payload JSONB,
  attempt_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | sending | unknown | accepted | sent | delivered | read | failed
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  provider_sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  provider_status_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent for databases created before weekly WhatsApp campaigns existed.
ALTER TABLE subscriber_sends ADD COLUMN IF NOT EXISTS campaign_key TEXT;
ALTER TABLE subscriber_sends ADD COLUMN IF NOT EXISTS event_ids INT[] NOT NULL DEFAULT '{}';
ALTER TABLE subscriber_sends ADD COLUMN IF NOT EXISTS template_payload JSONB;
ALTER TABLE subscriber_sends ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0;
ALTER TABLE subscriber_sends ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE subscriber_sends ADD COLUMN IF NOT EXISTS provider_sent_at TIMESTAMPTZ;
ALTER TABLE subscriber_sends ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE subscriber_sends ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE subscriber_sends ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE subscriber_sends ADD COLUMN IF NOT EXISTS provider_status_at TIMESTAMPTZ;
ALTER TABLE subscriber_sends ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_subscriber_sends_subscriber ON subscriber_sends(subscriber_id, sent_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriber_sends_weekly_campaign
  ON subscriber_sends(subscriber_id, campaign_key)
  WHERE campaign_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriber_sends_provider_message
  ON subscriber_sends(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE subscriber_sends ENABLE ROW LEVEL SECURITY;

-- Editorial highlights: 0-4 short, concrete phrases an attendee gets, each one
-- traceable to a sentence in the organizer's own description (lib/summarize.ts).
-- Empty is the correct value for a vague listing — an invented perk would break
-- the same honesty rule that keeps price_type null when a page never states a
-- price. `summary` is rewritten by the same pass into 1-2 scannable sentences.
ALTER TABLE events ADD COLUMN IF NOT EXISTS highlights TEXT[] NOT NULL DEFAULT '{}';

-- Registration deadline, when the source publishes one. schema.org puts this on
-- offers.validThrough (when ticket sales end), which is the only structured
-- signal any of our sources carry for it. Null is common and must stay null:
-- lib/summarize.ts is forbidden from mentioning a closing date it wasn't given.
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_note TEXT;

-- Deduplicate search_queries and make the uniqueness rule actually hold.
--
-- `UNIQUE (query_text, site_filter)` looks right but does nothing for the rows
-- that matter: in Postgres NULL is never equal to NULL, so every query without
-- a site filter could be inserted again on each seed run. The table reached 69
-- rows for 43 distinct queries — 38% of every sweep spent re-running the same
-- searches at 2 Firecrawl credits each.
--
-- Keeping the lowest id preserves whichever copy discovery_items already
-- reference, so no provenance is lost.
DELETE FROM search_queries a
 USING search_queries b
 WHERE a.id > b.id
   AND a.query_text = b.query_text
   AND COALESCE(a.site_filter, '') = COALESCE(b.site_filter, '');

ALTER TABLE search_queries DROP CONSTRAINT IF EXISTS search_queries_query_text_site_filter_key;

-- COALESCE inside the index is what makes NULL comparable, so a site-less
-- query can only exist once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_queries_unique
  ON search_queries (query_text, COALESCE(site_filter, ''));

-- ============================ SOURCES ===========================
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('lu.ma', 'Luma', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('meetup.com', 'Meetup', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('eventbrite.com', 'Eventbrite', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('gdg.community.dev', 'GDG Community (Google Developer Groups)', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('hasgeek.com', 'Hasgeek', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('chennaijs.dev', 'ChennaiJS', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('chennaipy.org', 'Chennaipy (Chennai Python User Group)', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('owasp.org', 'OWASP Foundation (Chennai Chapter)', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('konfhub.com', 'KonfHub', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('91springboard.com', '91Springboard', 'curator_only', false, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('respark.iitm.ac.in', 'IIT Madras Research Park', 'curator_only', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('rtbi.in', 'RTBI / IIT Madras Incubation Cell', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('startuptn.in', 'StartupTN', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('villgro.org', 'Villgro', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('chennai.tie.org', 'TiE Chennai', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('community.nasscom.in', 'NASSCOM Community', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('ecell.iitm.ac.in', 'IIT Madras E-Cell', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('annauniv.edu', 'Anna University', 'curator_only', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('technovit.vit.ac.in', 'TechnoVIT (VIT Chennai)', 'curator_only', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('srmist.edu.in', 'SRM Institute of Science and Technology', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('chennaidatacircle.in', 'Chennai Data Circle (CDC)', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('chennai.aitinkerers.org', 'AI Tinkerers Chennai', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('null.community', 'null - The Open Security Community (Chennai chapter)', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('theproductfolks.com', 'The Product Folks (Grabchai Chennai)', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('chennaimarketerscircle.com', 'Chennai Marketers Circle (CMC)', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('ixdf.org', 'IxDF Chennai (Interaction Design Foundation)', 'curator_only', false, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('meetups.umo.design', 'UMO City Meetups (UXINDIA Chennai chapter)', 'curator_only', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('luma.com', 'Luma (luma.com)', 'auto_fetch', true, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('linkedin.com', 'LinkedIn Events', 'curator_only', false, 120, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('eventbrite.com.au', 'Eventbrite (AU)', 'auto_fetch', true, 30, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('eventbrite.co.uk', 'Eventbrite (UK)', 'auto_fetch', true, 30, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('eventbrite.ca', 'Eventbrite (CA)', 'auto_fetch', true, 30, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('eventbrite.sg', 'Eventbrite (SG)', 'auto_fetch', true, 30, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;
INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES ('friends.figma.com', 'Friends of Figma (Chennai)', 'auto_fetch', true, 30, true) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;

-- ========================= SEARCH QUERIES =======================
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai AI meetup 2026', 'ai', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai artificial intelligence conference', 'ai', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai AI events', 'ai', 'site:lu.ma', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai AI meetup', 'ai', 'site:meetup.com', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai tech meetup 2026', 'tech', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai technology conference 2026', 'tech', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai tech events', 'tech', 'site:lu.ma', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai tech conference', 'tech', 'site:eventbrite.com', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai cybersecurity conference 2026', 'cybersecurity', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai cybersecurity meetup', 'cybersecurity', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai cybersecurity meetup', 'cybersecurity', 'site:meetup.com', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai cybersecurity events', 'cybersecurity', 'site:lu.ma', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai startup event 2026', 'startups', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai startup meetup', 'startups', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai startup events', 'startups', 'site:lu.ma', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai startup networking meetup', 'startups', 'site:meetup.com', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai digital marketing conference 2026', 'marketing', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai marketing meetup', 'marketing', 'site:meetup.com', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai marketing events', 'marketing', 'site:lu.ma', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai product management meetup 2026', 'product', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai product manager meetup', 'product', 'site:meetup.com', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai product management events', 'product', 'site:lu.ma', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai UX design meetup 2026', 'design', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai design conference', 'design', 'site:eventbrite.com', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai design events', 'design', 'site:lu.ma', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai fintech conference 2026', 'finance', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai finance professionals meetup', 'finance', 'site:meetup.com', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai fintech events', 'finance', 'site:lu.ma', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai data engineering meetup 2026', 'data', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai cloud computing conference', 'data', NULL, true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai data analytics meetup', 'data', 'site:meetup.com', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('Chennai big data events', 'data', 'site:lu.ma', true) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('AI meetup Chennai', 'ai', 'site:linkedin.com/events', false) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('machine learning event Chennai', 'ai', 'site:linkedin.com/events', false) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('tech meetup Chennai', 'tech', 'site:linkedin.com/events', false) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('developer event Chennai', 'tech', 'site:linkedin.com/events', false) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('cybersecurity event Chennai', 'cybersecurity', 'site:linkedin.com/events', false) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('product management event Chennai', 'product', 'site:linkedin.com/events', false) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('UX design event Chennai', 'design', 'site:linkedin.com/events', false) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('marketing growth event Chennai', 'marketing', 'site:linkedin.com/events', false) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('startup founders event Chennai', 'startups', 'site:linkedin.com/events', false) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('fintech event Chennai', 'finance', 'site:linkedin.com/events', false) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;
INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES ('data cloud event Chennai', 'data', 'site:linkedin.com/events', false) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;

-- 34 sources, 43 search queries.
-- Events are NOT copied: the pipeline rediscovers them on its first run,
-- and stale event rows would ship a feed that was already out of date.
