# Host venue photo handoff

Claude's frontend commit `4ae9904` is preserved. `HostVenuePanel` now uses the
host clients in `lib/client/hostApi.ts`; it no longer calls curator-only APIs.
The remaining presentation and running-session logic are unchanged.

All endpoints require a currently approved, verified host session or a curator
session. `getHostVenueSlug()` selects Time Cafe on the server. Browser-supplied
slugs, roles, rates, and capacities do not grant authority.

| Method | Endpoint | Body | Success response |
| --- | --- | --- | --- |
| GET | `/api/host/venue` | — | `{ ok: true, venue: AdminVenue }` |
| PATCH | `/api/host/venue` | `{ photos: string[] }` | `{ ok: true, venue: AdminVenue }` |
| POST | `/api/host/venue/photos` | Multipart `file` | `{ ok: true, id, url, mime, byteSize }` |
| PATCH | `/api/host/venue/spaces/[rowId]` | `{ image: string }` | `{ ok: true, space: AdminSpace }` |

The gallery accepts up to 30 unique photos, in cover-first order. Existing
curator-selected URLs can be retained. New URLs must refer to images uploaded
for this venue. Room-photo updates change only `image`, with the owning venue
checked in the database UPDATE. They cannot overwrite room prices or capacity.

Uploads reuse `storePosterBytes` and `poster_uploads`. JPG/PNG/WebP magic bytes
and the existing 5 MB size limit are enforced. Images retain stable public
`/api/poster/<id>` URLs. The existing `origin_url` field records
`host-venue:time-cafe` for ownership; there is no new table or migration.
Existing cleanup retains photos referenced by venue galleries and rooms.

`BookingCountdown.formatRemaining()` is the single countdown formatter. The
unused `lib/client/useCountdown.ts` was removed. Keep the timer without
per-second screen-reader announcements, and keep venue rates in whole rupees
while menu prices remain in paise.

## Verification

Run the existing isolated PostgreSQL regression using a temporary PGlite
installation outside the repository:

```sh
node --import tsx scripts/test-venue-host-access.ts --pglite=/absolute/path/to/@electric-sql/pglite
node --import tsx scripts/test-venue-launch.ts --pglite=/absolute/path/to/@electric-sql/pglite
npm run test:venue-auth
npm run lint
npm run build
```

The host regression covers real OTP verification against fixture SQL, proxy and
route authorization, host/admin separation, photo upload/serve/save/reorder/
remove, ownership, room scope, preserved prices/capacity, QR clock persistence,
menu-order retries, event completion, revoked access, and expired sessions.
It blocks external requests and never sends WhatsApp messages or takes payment.
If a local sandbox prevents Turbopack's worker from binding a port,
`npm run build -- --webpack` verifies the supported alternative compiler.
