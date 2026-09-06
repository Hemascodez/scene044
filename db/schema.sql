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
  provider TEXT,                     -- 'aisensy' | email provider, once chosen
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | sent | delivered | failed
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriber_sends_subscriber ON subscriber_sends(subscriber_id, sent_at DESC);

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
