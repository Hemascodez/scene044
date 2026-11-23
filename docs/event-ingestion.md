# Event ingestion: Luma, Meetup and KYN

## Scope and schedule

Chennai, Bengaluru/Bangalore, Mumbai and **all Kerala cities**. Kerala is a
state, never a city tag. Search includes its districts/major towns and a broad
Kerala query; any other town is eligible when the event's own address states
Kerala. No title, organizer location or search-query city overrides a venue.

The approved production schedule is **Monday, Tuesday and Friday at 21:00 IST**
(`30 15 * * 1,2,5` UTC). This is scheduled discovery, not real-time delivery.
Search engines and platforms do not expose every event immediately or guarantee
complete coverage. District queries rotate within the search limit; they do not
all run on every sweep. Twelve broad market/platform queries have daily priority.

## Pipeline

1. Apply the additive ingestion migration; seed sources/queries idempotently.
   Existing manual source trust/active settings and curator decisions win.
2. Requeue due approved public feeds (currently Luma Bengaluru/Mumbai and KYN
   eventhome). Expand detail links instead of mistaking a city feed for an event.
3. Search up to 20 rotating queries with India, not Chennai, localization.
4. Fetch public detail pages: normal JSON-LD first; KYN's public streamed JSON-LD
   next; AI extraction only where necessary. No private platform APIs, logins,
   attendee data, hidden venue coordinates or CAPTCHA bypasses.
5. Validate dates, supported city, a real source description, organizer and venue.
   AI-only extraction additionally requires high confidence and verbatim source
   date/venue evidence. Missing or withheld details go to curator review.
6. Deduplicate using existing title/date/city/venue/source matching. Generate
   source-grounded editorial copy, then publish event/source/queue completion in
   one transaction. Failed editorial generation never publishes an empty page.
7. Existing dynamic event pages supply metadata, canonical URLs, Event JSON-LD,
   source attribution, category links and sitemap entries from the saved facts.
   Intercity city chips come from those events; Chennai collections stay local.

## Limits and controls

- `EVENT_MAX_PUBLISH_PER_RUN=10` by default, hard ceiling 50. `0` stops extraction
  publication/processing for both CLI and authenticated HTTP triggers. Search
  discovery can still enqueue URLs. Raising this requires a quality/budget review.
- KYN rendering is **off by default**. `EVENT_RENDER_ENABLED=true` enables the
  existing Firecrawl `/v2/scrape` connection only when a successful public KYN
  page still has no readable data. `EVENT_RENDER_LIMIT=5` defaults to five calls
  per worker/process six-hour window (hard ceiling 20). This is **not a global
  account-wide spending cap**. Normal KYN streamed detail data avoids rendering.
- Renderer uses basic mode, TLS checks, no credentials/actions, fresh output
  (`maxAge=0`), bounded response size, and validated same-page metadata. It never
  retries a blocked response through enhanced/stealth proxies.
- `robots.txt` checked per origin with an hourly cache, including redirects.
  Unknown policy/network failures defer; explicit denial goes to review.
- Expiring item leases and a shared extraction advisory lock prevent concurrent
  workers from publishing the same queued item. A failed process is recoverable.
- Transient failures get bounded backoff (15/30/60 minutes); after four attempts
  they go to review. A retry is picked up during the current 20-minute run if due,
  otherwise on a later scheduled run. No background process stays running forever.
- `extraction-pass` logs report counts/retry eligibility. Curator queue preserves
  reasons such as `source_evidence_review`, `missing_source_venue`,
  `no_confident_category` and `pipeline_stage_error` rather than silently deleting
  candidates. Source categories outside Scene's ten existing categories require
  curator classification; they are not forced into tech or arts.

## Checks and rollout

`npm run test:event-ingestion` uses isolated PGlite with mocked DNS/network. It
does not use `.env.local`, real providers or any live database. Existing date,
price, Intercity and SEO tests should also pass, followed by the production build.

`npm run probe:event-ingestion -- --url https://luma.com/bengaluru` reads one
public page without DB writes. `--render` permits one Firecrawl request;
`--model` permits AI extraction; `--assess` permits classification/editorial calls
but **still never publishes**. Those flags may use provider credits.

Verified public probes on 23 November 2026:

- Luma Bengaluru feed: 16 detail links; sampled event extracted with correct city.
- Meetup Chennai detail: structured title/date/city parsed successfully.
- KYN directory: 85 unique event detail links with bounded public rendering.
- KYN detail: streamed JSON-LD + visible venue parsed without rendering or AI.
- One source-backed Luma classification/editorial assessment succeeded with the
  existing production connection, with zero database writes.

Publish cautiously: initial cap 10 per run; sample-review the first batch before
raising it. New imports are not SCENE-hosted events and must not gain native
checkout or host access. Existing registrations, payments, venue pricing,
WhatsApp messages and subscriptions are not changed by this work.

## Known follow-ups

- API/organizer calendar partnerships improve completeness: Luma calendar keys
  only access their own calendar, and Meetup API access has its own requirements.
  No subscriptions were purchased or accounts connected for this work.
- Existing verification currently checks reachability/expiry, not every semantic
  date/price/venue change. A full change-detection/reconciliation service should
  queue differences for review without overwriting curator edits or paid events.
- Legacy rejected rows are deliberately not bulk revived. Re-probe known missed
  future events individually; preserve old curator decisions and past events.
- Multi-city event metadata is already dynamic; no mass thin city landing pages
  are generated. Automatic SEO cannot guarantee Google indexing or first place.

References: [Firecrawl search](https://docs.firecrawl.dev/api-reference/endpoint/search),
[Firecrawl scrape](https://docs.firecrawl.dev/api-reference/endpoint/scrape),
[Luma API](https://docs.luma.com/reference/getting-started-with-your-api),
[Meetup API](https://www.meetup.com/graphql/),
[Railway scheduling](https://docs.railway.com/cron-jobs).
