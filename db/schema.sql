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

-- One scannable sentence for the "At a glance" block that opens the event page.
-- Its own column rather than the first sentence of `summary`, because the story
-- is instructed to open with a hook: that opening line is usually rhetorical
-- rather than the fact a scanner needs. Null whenever `summary` is null — the
-- two are generated as one content unit (lib/summarize.ts).
ALTER TABLE events ADD COLUMN IF NOT EXISTS gist TEXT;

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

-- Status vocabulary, revised.
--
-- `stale` is gone from both tables. It meant "the source page vanished" but
-- read as "possibly out of date", and it kept showing the event publicly while
-- saying so — the worst of both. Vanished listings now go back to the curator
-- queue as pending_review; events whose date has passed become `expired`.
--
-- discovery_items gains two states:
--   needs_date_review — no reliable event date could be read, including by the
--                       model. Unknown is not past, so this is a queue for a
--                       human rather than a rejection.
--   expired           — the candidate's own date has passed, or it sat
--                       unreviewed long enough that it cannot still be upcoming.
--
-- Nothing is deleted. Expired rows stay for auditing, and for a "what you
-- missed" surface, which needs exactly this data.
CREATE INDEX IF NOT EXISTS idx_events_upcoming
  ON events (COALESCE(end_at, start_at))
  WHERE status IN ('live', 'updated');

CREATE INDEX IF NOT EXISTS idx_discovery_items_curator_queue
  ON discovery_items (status, discovered_at DESC);

-- ---------------------------------------------------------------- Venue booking
--
-- The venue side started as a browser-only prototype (localStorage), which was
-- fine until two devices needed the same booking: the organizer shows a check-in
-- QR on their phone and the venue owner scans it on theirs, and the owner's
-- dashboard has to show a review the organizer wrote elsewhere. Neither is
-- possible without a server, so bookings live here.
--
-- Holds organizer name/email/phone, so it takes the same posture as
-- `subscribers`: RLS on with no policies, plus the REVOKE belt-and-braces. The
-- app's own pg connection is the table owner and bypasses RLS.
CREATE TABLE IF NOT EXISTS venue_bookings (
  id SERIAL PRIMARY KEY,
  -- Short, unambiguous, human-readable. Read aloud at reception and used to
  -- attach food orders to the right event, so it avoids look-alike characters.
  code TEXT NOT NULL UNIQUE,
  -- Unguessable; the payload inside the check-in QR. Possession of this is what
  -- authorizes marking the event started, so it is never derived from `code`.
  checkin_token TEXT NOT NULL UNIQUE,
  venue_slug TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  space_id TEXT NOT NULL,
  space_name TEXT NOT NULL,
  -- Requested slot. `duration_hours` drives both the price and the live timer.
  event_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  duration_hours INT NOT NULL CHECK (duration_hours > 0),
  people INT NOT NULL CHECK (people > 0),
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  organizer_name TEXT NOT NULL,
  organizer_email TEXT NOT NULL,
  organizer_phone TEXT NOT NULL,
  trust_type TEXT,
  trust_url TEXT,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false,
  email_opt_in BOOLEAN NOT NULL DEFAULT false,
  hourly_rate INT,
  total INT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','confirmed','checked_in','completed','declined','cancelled','expired')),
  -- Set when the owner scans the QR. `ends_at` is computed from it rather than
  -- from the requested start, because the timer must follow when the event
  -- actually began, not when it was booked to.
  checked_in_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- Set once the "your booked time is up" notification has gone out, so a
  -- repeating sweep cannot send it twice.
  overrun_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_bookings_host_queue
  ON venue_bookings (venue_slug, status, event_date);

-- The sweep that sends the overrun ping reads exactly this shape.
CREATE INDEX IF NOT EXISTS idx_venue_bookings_running
  ON venue_bookings (ends_at)
  WHERE status = 'checked_in' AND overrun_notified_at IS NULL;

ALTER TABLE venue_bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON venue_bookings FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON venue_bookings FROM authenticated';
  END IF;
END $$;

-- Food and drink the venue owner attaches to a running event.
--
-- This is the "when several events run at once, who ordered what" answer: line
-- items keyed to a booking, summed against the space's minimum food spend.
CREATE TABLE IF NOT EXISTS venue_booking_orders (
  id SERIAL PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES venue_bookings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount INT NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_booking_orders_booking
  ON venue_booking_orders (booking_id, created_at);

-- Post-event reviews, written only by the organizer of a completed booking.
--
-- One review per booking (the unique constraint is the whole anti-astroturfing
-- mechanism): you cannot review a venue you never booked, and you cannot review
-- the same event twice. `rating` is the 1-5 emoji scale; `tags` are the aspect
-- chips (wifi/food/vibe/space/location) the organizer picked.
CREATE TABLE IF NOT EXISTS venue_reviews (
  id SERIAL PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE REFERENCES venue_bookings(id) ON DELETE CASCADE,
  venue_slug TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags TEXT[] NOT NULL DEFAULT '{}',
  comment TEXT,
  -- Organizer's own event photos. Stored as ids into poster_uploads, reusing the
  -- verified-magic-bytes path rather than inventing a second image pipeline.
  photo_ids INT[] NOT NULL DEFAULT '{}',
  -- Attendees appear in event photos, so publishing them needs explicit consent.
  photo_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_reviews_venue
  ON venue_reviews (venue_slug, created_at DESC);

ALTER TABLE venue_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON venue_reviews FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON venue_reviews FROM authenticated';
  END IF;
END $$;

-- Venue partner leads.
--
-- The "list your venue" form previously rendered a success message and threw the
-- submission away, so every real lead was lost. These land in the curator queue
-- instead, which is the only place anyone is watching.
CREATE TABLE IF NOT EXISTS venue_partner_requests (
  id SERIAL PRIMARY KEY,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  area TEXT NOT NULL,
  link TEXT,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','onboarding','listed','declined')),
  curator_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_partner_requests_queue
  ON venue_partner_requests (status, created_at DESC);

-- Contact details for a person who volunteered them: same posture as subscribers.
ALTER TABLE venue_partner_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON venue_partner_requests FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON venue_partner_requests FROM authenticated';
  END IF;
END $$;

-- ---------------------------------------------------------------- Venue catalog
--
-- Venue content moves out of the hardcoded TS registry (lib/venues.ts) and in
-- here so the curator can add a venue and edit every field of its public page
-- without a deploy. lib/venues.ts keeps the types and the pricing helpers, and
-- scripts/seed-venues.ts seeds Time Cafe from the constant that used to be the
-- only source of truth.
--
-- No RLS: this is public catalog content, the same class of data as `events`.
CREATE TABLE IF NOT EXISTS venues (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Chennai',
  address TEXT,
  summary TEXT NOT NULL DEFAULT '',
  -- 'coming-soon' renders a non-bookable teaser; 'hidden' keeps a draft out of
  -- the public site entirely while the curator is still filling it in.
  status TEXT NOT NULL DEFAULT 'hidden'
    CHECK (status IN ('live','coming-soon','hidden')),
  -- The venue's own public dining rating. Explicitly not an events rating, and
  -- labelled that way wherever it is shown.
  rating NUMERIC,
  rating_count INT,
  rating_url TEXT,
  phone TEXT,
  map_url TEXT,
  map_embed_url TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  amenities TEXT[] NOT NULL DEFAULT '{}',
  policies TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venues_public ON venues (status, name);

-- The bookable rooms within a venue. Rates are nullable because a real space
-- can be quote-only (Time Cafe's terrace), and null must never render as free.
CREATE TABLE IF NOT EXISTS venue_spaces (
  id SERIAL PRIMARY KEY,
  venue_id INT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  space_key TEXT NOT NULL,
  name TEXT NOT NULL,
  eyebrow TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  capacity TEXT NOT NULL DEFAULT '',
  max_guests INT NOT NULL CHECK (max_guests > 0),
  image TEXT,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  community_rate INT,
  production_rate INT,
  minimum_food_spend INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (venue_id, space_key)
);

CREATE INDEX IF NOT EXISTS idx_venue_spaces_venue ON venue_spaces (venue_id, sort_order, id);

-- Editorial promotion: a curator can pin a specific event above the normal
-- soonest-first order, in every tab of the discovery feed and every category
-- page. Off by default — nothing is promoted unless a curator says so.
ALTER TABLE events ADD COLUMN IF NOT EXISTS promoted BOOLEAN NOT NULL DEFAULT false;
