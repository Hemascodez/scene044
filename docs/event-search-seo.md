# Chennai event search: implementation and rollout

## What changed

- Permanent discovery pages: `/events/chennai/this-week`, `/this-weekend`,
  `/today`, `/free`, `/tech-this-week`, and `/finance-this-week` under that prefix.
- Every page reads the curated public event feed, renders the existing ticket
  cards on the server, has a unique heading/title/description/canonical, and
  emits a matching CollectionPage/ItemList plus breadcrumbs.
- The existing footer links to these pages, and sitemap generation includes
  each one. There are no hidden keyword blocks or fabricated event listings.
- “This week” matches the existing next-seven-calendar-days filter. Dates
  use Asia/Kolkata, including Sunday/weekend and year boundaries. Free means
  explicitly free, not an unknown price. Published end times are respected.
- Combined category links remain usable but are noindex/follow; reordered,
  repeated or invalid key variants redirect to their normalised canonical.
- Event JSON-LD no longer invents ticket availability or treats a generic stock
  image as an official event poster. Invalid start/end dates are not emitted.
- Venue UI, pricing, booking and payment logic are unchanged. Existing event
  card/hero layouts are reused; category headings and footer links are content
  additions, not a redesign.

## Verification

`npm run test:seo` includes isolated tests for filtering, IST boundaries,
metadata, sitemap inclusion, canonical variants, matching server-rendered
cards/schema, honest empty states and database failures. No live DB writes or
WhatsApp sends are used. `npm run lint` and `npm run build` check integration.
If the local sandbox prevents Turbopack's helper process binding to a port,
`npx next build --webpack` verifies the production build without changing the
deployment configuration.

## After deployment

1. Confirm the live pages return 200, render real events, and have production
   canonicals; unknown collection names must return 404.
2. Validate live event detail URLs in Google's Rich Results Test. Collection
   pages are ItemLists, not fake single events. Missing source information
   (for example a full street address or an official poster) must be collected
   from organisers, never guessed just to silence a warning.
3. Resubmit `https://scene044.in/sitemap.xml` in Search Console. Inspect the
   discovery URLs and request indexing for the most useful ones. Check Google's
   selected canonical and Page Indexing reports after recrawling.
4. Compare Search Console queries, impressions, clicks and average position
   before/after deployment. Track event registration-link clicks separately
   from venue booking conversions; event registration happens off-site.
5. Keep listings fresh, consolidate duplicate editions carefully, and ask event
   organisers/communities to link to their SCENE event detail pages. Useful
   listings and genuine local links matter beyond technical markup.

No first-position ranking, indexing deadline or rich-result appearance is
guaranteed. Do not buy links, manufacture reviews, claim unsupported events,
or generate dozens of near-identical city/category pages.

## Newly added events and safe automation (17 November 2026)

SEO metadata is computed from the current published event on every request.
Both curator-added and pipeline-added events already get a canonical URL,
server-rendered metadata, poster previews, breadcrumbs, Event JSON-LD and a
sitemap entry. There is no separate per-event SEO generation/deployment step.

The November update makes the actual event subject lead the search snippet,
reserves room for its date/city, shortens address-heavy venue names in metadata
only, and avoids repeating the city in a title that already contains it.
The complete venue/address and official title remain unchanged. Structured
descriptions use the full published story; prices and external availability
are never inferred to make a rich-result warning disappear.

Run the bounded, read-only reviewer after adding events:

```sh
npm run seo:events -- --since=2026-11-17
npm run seo:events -- --ids=185,186,187,188,189,190,191,192
npm run test:event-seo-quality
```

Dates supplied to `--since` start at midnight Asia/Kolkata. With no selection,
the checker examines the latest 30 upcoming published events; it explicitly
reports when the selection was capped. It reads only the public feed, sitemap
and selected detail pages, stops on rate limiting, and never follows source
links. Technical failures set a nonzero exit status; editorial/source gaps
remain review items, not automatic unpublishing or invented fixes.

### Recommended next step: publication-triggered SEO assistant

Keep deterministic metadata generation above as the automatic layer. A future
worker should consume a publication/update outbox keyed by event ID, content
version and SEO rules version. Coalesce repeat edits, retry transient failures
with bounds, and skip stale versions. Store its checks and suggested changes
privately, not on the public event payload.

Allow automatic validation of canonical/sitemap/schema parity. Queue missing
venues, ambiguous prices/date-only timestamps and conflicting daypart copy for
curator review. If AI drafts a better gist or description, give it only the
official public source facts, treat that source as untrusted data, and require
curator approval before replacing visible copy. Never change dates, cities,
prices, availability, slugs, registrations or payment data on an AI guess.

Measure impressions/clicks and indexing through an authorized Search Console
connection. Google does not provide a general event-URL instant-indexing API;
keep the dynamic sitemap discoverable and use normal URL inspection when
appropriate. Do not repeatedly submit the sitemap for every page edit.

No autonomous worker, schedule, paid model call, Search Console submission or
subscriber message is enabled by this change. `seo:events` is the reusable
read-only validation foundation, not a claim that a full agent is running.

Google references:
- https://developers.google.com/search/docs/appearance/structured-data/event
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
