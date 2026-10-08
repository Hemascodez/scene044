# Host venue photo handoff

Claude's frontend commit `4ae9904` is preserved. `HostVenuePanel` now uses the
host clients in `lib/client/hostApi.ts`; it no longer calls curator-only APIs.
The remaining presentation and running-session logic are unchanged.

All endpoints require a currently approved, verified host session or a curator
session. `getHostVenueSlug()` selects the session's approved venue on the server
(curators preview Time Cafe). Browser-supplied
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
`host-venue:<venue-slug>` for ownership; no second photo storage path is added.
Existing cleanup retains photos referenced by venue galleries and rooms.

## Curator host membership

Curator → Host access accepts a mobile number, optional name, and a required
venue selection from the real catalog. `GET /api/admin/venue-hosts` returns
`hosts` (including `venueSlug` / `venueName`) and `venues` (`slug` / `name`).
POST accepts `{ phone, label?, venueSlug }`; DELETE by access-record id revokes
only that venue membership. No phone or additional venue is auto-approved.

`2026-10-08-multi-venue-host-access.sql` removes the Time Cafe-only constraint,
adds a catalog foreign key, and pins each verified host session to its chosen
venue. Existing approved Time Cafe sessions are migrated once; later migration
runs never promote organiser sessions. Revocation is checked on every request.
OTP verification locks and checks the matching approval, so an organiser OTP,
profile edit, query parameter, or another-device login cannot confer access.
Bookings, QR check-in, menu, reviews, and photos all use that server-owned scope.
The public host sign-in picker exposes only names/slugs of live venues with
approved staff, never their phone numbers. Only Time Cafe is currently registered.

Mutation origins accept the canonical SCENE HTTPS domains even when Railway
provides an internal HTTP URL. Cross-site requests and arbitrary forwarded-host
headers remain rejected. No authentication or CSRF protection is disabled.

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
# Curator change alerts

Saving the host gallery (including cover order/removal) or a room photo writes a
durable `venue_host_changes` record in the same transaction as the catalog edit.
Unchanged saves create no alert. Public venue routes read the current catalog
on each request; an already-open visitor page needs a refresh to see the edit.

The curator's **Host changes** section shows the venue, saved account name,
changed field and IST timestamp. Its unread badge and toast poll every 15 seconds.
Marking read preserves the history. The API is curator-only; hosts cannot read or
acknowledge the feed. No WhatsApp message is sent for these edits (no approved
venue-edit template exists). Gallery uploads remain drafts until Save changes;
room photos save immediately. Account profile name/email and private menu edits
are separate from the venue's public catalog, not public venue metadata edits.
