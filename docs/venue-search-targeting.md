# Venue search intent

Focus existing, indexable venue pages on local searches with booking intent.
These are editorial targets based on the published inventory, not verified
search-volume estimates or a promise of rankings.

| Existing page | Primary intent | Related searches |
| --- | --- | --- |
| `/venues` | Workshop and small event venues in Chennai | Chennai meetup spaces; creative studios for hire |
| `/venues/time-cafe` | Workshop and meetup venue in Nungambakkam, Chennai | Small professional gathering space; cafe workshop venue |
| `/venues/chennai-yoga-studio` | Art and dance studio in Kilpauk, Chennai | Art workshop space; dance rehearsal studio; yoga and wellness venue |
| `/venues/the-freshlymade-resto-cafe` | Weekday meeting space in RA Puram, Chennai | Small cafe workshop space; weekday small gathering venue |

## Guardrails

- Reuse the existing pages; do not generate thin area/keyword doorway pages.
- Keep names, neighbourhoods, capacity, cover photos, rates and packages sourced
  from the catalog. Do not change them or publish guessed amenities for SEO.
- Keep FreshlyMade's Monday–Friday restriction prominent in metadata and retain
  its existing visible notice and booking-date enforcement.
- Market the Yoga Studio for arts, dance, yoga and wellness, not unsupported
  parties, tech launches or soundproof recording.
- Preserve the venue summaries managed by the curator. Time Cafe's existing
  About paragraph now reads its catalog summary too, rather than stale fixed
  copy; no new section is added.
- Keep Claude's components, classes, layout, search controls and booking flow.
  Visible changes are copy and location-aware image text only.
- No meta-keyword tags, hidden keyword blocks, fabricated ratings, invented
  availability, new FAQs or unverified refund promises.

## Implementation and checks

`lib/venueDiscovery.ts` shares the intent wording between visible introductions
and metadata. `lib/seo.ts` keeps unique canonical venue titles/descriptions and
adds a live-only CollectionPage/ItemList for the existing venue landing page.
The existing detail canonical URLs, cover images and sitemap remain in place.

Run `npm run test:seo`, `npx tsc --noEmit`, lint and a production build. The
discovery regression test checks factual capacity, weekday restrictions,
Yoga package prices staying untouched, live-only structured data, safe JSON-LD,
crawlable card links, and unchanged component styling/element structure.

After deployment, inspect the rendered titles/descriptions/canonicals and sitemap
on production. Monitor non-brand venue impressions, clicks and actual booking
requests in Search Console and Analytics; ranking improvements require crawling
and are not guaranteed. This change does not launch ads, alter tracking, contact
partners or submit requests in Search Console.
