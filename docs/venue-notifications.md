# Approved venue WhatsApp notifications

Meta verified all ten templates APPROVED on 8 October 2026. Language: `en`
(not `en_US`). Names and body-variable order are in `lib/venueNotifications.ts`.
These Utility notifications are separate from OTP and the weekly marketing digest.

| Actual event | Organiser | Approved Time Cafe hosts |
| --- | --- | --- |
| Request saved | `scene044_booking_requested_v2` | `scene044_new_booking_request` |
| Host approves priced request | `scene044_booking_approved` | — |
| Razorpay capture verified and committed | `scene044_booking_confirmed` | `scene044_host_booking_confirmed` |
| Host declines | `scene044_booking_declined` | — |
| Host cancels / organiser withdraws | `scene044_booking_cancelled` (correct actor) | — |
| Backend changes request to expired | `scene044_booking_expired` | — |
| Checked-in session reaches ends_at | `scene044_venue_overrun` | — |
| Venue application saved | `scene044_venue_listing_received` to submitting contact | — |

No automatic expiry rule is added: the tracker currently lets unanswered requests
keep waiting after 48 hours. An expiry message sends only on a real `expired`
transition. No approved host-cancellation, refund, review-request or abandoned-draft
template exists yet; don't reuse another template with misleading copy.
Quote-only approvals are skipped until a genuine payable quote exists.

## Deployment

`npm run migrate` applies the idempotent
`db/migrations/2026-10-08-venue-notifications.sql` after the existing schema.
No historical booking/application messages are backfilled. Database triggers
enqueue only new committed events, including payment transactions; rollbacks
also roll back the queue. The payload excludes QR tokens, email and descriptions.

Set **only on the Railway website**:

```env
WHATSAPP_VENUE_NOTIFICATIONS_ENABLED=true
```

The existing `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and
`WHATSAPP_GRAPH_API_VERSION` are reused. No new credentials or Meta webhook URL.
Leave the switch absent/false locally. `next build` and `next dev` never start
the worker. `next start` registers one 60-second worker per Node process via
`instrumentation.ts`; mutation routes also wake the queue after sending their
response. This is for our persistent Railway Node deployment, not serverless.

The worker queues session-end notices atomically, then drains pending events.
The old `npm run venue-overrun-notify` command uses the same queue if retained;
an additional cron service is not required. Old `WHATSAPP_OVERRUN_TEMPLATE_*`
variables are no longer used. Do not enable the weekly digest or trigger it as
part of this rollout.

Organisers must have booking WhatsApp opt-in. Hosts come from currently approved
`venue_host_access` records; permission is rechecked before dispatch. Archived
bookings, withdrawn consent, revoked hosts and superseded status messages are
skipped. Registering a host later does not send old requests retrospectively.
Customer total is the listed venue cost (₹6,000, not ₹6,600); ₹10 curator trials
use their actual trial charge. Confirmed messages use the verified payment row.

## Reliability and monitoring

`venue_notifications.event_key` deduplicates an event per audience/recipient.
Atomic claims protect multiple workers. Only explicit Meta 429/5xx failures retry,
with exponential backoff, maximum five attempts. A timeout/lost response or a
worker dying mid-send becomes `unknown`, never automatically retried: Meta might
already have accepted it. Inspect Meta before manually resetting such a row.
Transport failures do not undo a successful booking.

`accepted` means Meta returned a message ID, **not** delivered. Existing signed
Meta webhook receipts advance the queue to delivered/read/failed. Opaque callback
IDs handle receipts arriving before the sender saves the provider ID.

Curator-only `GET /api/admin/venue-notifications` returns enabled state, counts
and recent errors, without recipient phone numbers or message contents.

## Isolated verification

```bash
node --import tsx scripts/test-venue-notifications.ts --pglite=/absolute/path/to/@electric-sql/pglite
npm run lint
npm run build
```

The regression uses disposable PostgreSQL, fake credentials and a stub sender;
no production bookings or WhatsApp messages are created. Covers every template,
parameter order, actual amounts, payment replay, rollback, no backfill, opt-in,
host revocation, archives, rate-limit backoff, unknown sends and receipt races.
