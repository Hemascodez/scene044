# Intercity events

The home feed has an Intercity tab for published in-person events whose city
is outside Chennai. Online events stay in the Online tab. Chennai discovery
tabs, category counts, fresh finds and Chennai SEO collections exclude these
out-of-city events.

City chips come from upcoming events, with no seeded empty cities. Search
updates their matching counts while retaining the available city choices.
Common aliases (Bangalore/Bengaluru, Bombay/Mumbai, etc.) share a city chip.
Names not in the alias map work without a code change. Titles, descriptions,
organizer names and audience tags are never used to guess an event's city.

## Publishing

Choose the city in the curator review form, or edit it on a published event.
The city is stored in the existing `events.city` column. Old saved drafts
without a city retain the former Chennai default. Existing published records
are not rewritten; correct their city through the editor where necessary.
City changes also update the event card and the existing event SEO metadata.

Structured extraction reads `location.address.addressLocality`. Text
extraction may return a city only when it is explicitly stated in the venue
location. The curator can review and correct it before publishing.

The scheduled crawler still targets Chennai; this change does not expand
paid searches or automatically publish events throughout India. Curator
publishing supports intercity events regardless of their Chennai relevance
score. Deduplication keeps otherwise similar events in different known cities
separate, while exact source-URL matches still identify the same event.

## Verification and rollout

Run `npm run test:intercity` for isolated city/filter, protected publishing,
database persistence and cross-city duplicate checks. Its database is mocked;
it does not change real events or call extraction services.

No new database migration is required for Intercity. The deployment must
already have the existing schema and event canonical migrations used by the
rest of the app. The local database reported a missing `event_aliases` table
during implementation; that prevents the existing public feed query from
loading and is separate from this feature.
