# Hosted events: backend contract

The frontend for SCENE-hosted events is built: the public event page
(`components/scene/hosted/`), event tickets in My bookings, and the
organiser's event workspace (`/host/events`). The backend below is implemented locally; see `HANDOFF.md` for activation steps and the unresolved local Razorpay credentials. No production event has been published by this work.
Types live in code, so this doc points at them rather than copying them:

- Event data: `HostedEventInfo` in `lib/hostedEvents.ts`
- Guest calls and ticket: `RegistrationApi`, `Ticket`, `CreatedRegistration` in
  `lib/client/eventRegistration.ts`
- My bookings: `MyEventTicket` in `lib/client/myEventTickets.ts`
- Organiser calls: `EventHostApi` and its types in `lib/client/eventHostApi.ts`

Designs: `docs/superpowers/specs/2026-11-12-hosted-event-page-design.md`,
`docs/superpowers/specs/2026-11-12-event-host-dashboard-design.md`.

## 0. Required before launch: let event hosts through `/host`

`proxy.ts` guards `/host` and `/api/host`. Event paths now admit curators or verified accounts with an active `event_host_access` approval. Venue paths keep their existing, separate approval rules. Shared host sign-in offers Event or Venue, and stores only the selected session scope.

Implemented access rules:

1. Approved event-host numbers and labels are stored per event, managed by the curator at `/admin/curator/hosting`.
2. `/host/events` and `/api/host/events/*` admit a
   signed-in SCENE user whose number is an approved host of at least one event
   (the venue rules for other `/host` paths stay as they are).
3. Every `/api/host/events/*` handler rechecks approval per event id: a
   host of event A must get 403 for event B.

The workspace already handles the responses: 401 → "Sign in to run your
event" (opens the shared WhatsApp sign-in), 403 → "This number isn't set up
for an event yet".

## 1. Event data

`getPublicEventById` (detail) must return `hosted: HostedEventInfo` for hosted
events and `null`/absent for every other event. The page switches layout on
that field alone.

| Field | Notes |
|---|---|
| `hostName` | The community: "Chapter Lounge" |
| `hostPerson` | The person hosting: "Sadhana" (or null). Shown as "Hosted by Sadhana · Chapter Lounge". |
| `pricePaise` | 29900. The only price the page shows; the client never sends an amount. |
| `capacity`, `registeredCount` | Count only paid, confirmed registrations. |
| `registrationState` | `open` / `sold_out` / `closed`. The page also treats `registeredCount >= capacity` as sold out and a past `endAt` as ended. |
| `description` | Plain text; blank line between paragraphs. Never rendered as HTML. |
| `gallery` | `{ src, alt }[]`, up to 7, in flipbook page order. The Chapter Lounge photos are at `/events/chapter-lounge/last-time-1..7.jpg`. |
| `quote` | `{ text, by }` or null. |
| `goodToKnow` | Numbered groups of icon cards: `{ group, note, items: { icon, text }[] }[]`. `icon` is one of `book`, `coffee`, `clock`, `qr`, `users`, `seating`, `sparkle`, `pin`. |
| `refundPolicy` | One line shown under "Refunds". For Chapter Lounge: "Tickets once booked cannot be exchanged or refunded." |
| `terms` | The organiser's Terms & conditions, in order, verbatim. The pay step links to them ("By paying, you agree to…"). |

Feed rows (`PublicEvent`) should carry `hostedPricePaise` so the feed card can
show its "Hosted · ₹299" badge.

Also needed on the event row: `poster_image_url` (`/events/chapter-lounge/poster.jpg`),
`venue_address` (Madras Adda's real street address), `organizer_name`,
`start_at` 2026-11-22 11:00 IST, `end_at` 13:00 IST, `price_type` `paid`,
`price_note` `₹299`, and a `primary_source_url` that points at the event page
itself (calendar files and `/api/go/[id]` use it). Reading and creative events use `arts`. The independent `SCENE hosted` discovery chip filters events carrying a server-side hosted price; it does not change their topic category or promote external Arts listings to hosted status.

## 2. Guest endpoints

Guests sign in with the **shared SCENE sign-in** (the existing WhatsApp OTP,
`/api/whatsapp/*`, session cookie) before registering. There is no
event-specific OTP. All bodies are JSON; errors are `{ error: string }` with
copy the page shows as is.

| Call | Auth | Body | Success | Errors the page handles |
|---|---|---|---|---|
| `POST /api/events/[id]/registrations` | session | `{ name, email, whatsappOptIn?: boolean }` (phone comes from the session; opt-in defaults false) | `CreatedRegistration` = `{ registrationToken, orderId, amount, currency, keyId }` | 401 → reopens sign-in · 409 `{ soldOut: true }` · 409 `{ existingTicketToken }` when this account already holds a confirmed ticket |
| `POST /api/events/[id]/registrations/verify` | session | `{ registrationToken, razorpay_order_id, razorpay_payment_id, razorpay_signature }` | `{ ticket, ticketToken }` | any non-2xx: page keeps "Payment received" with Retry and the payment ID |
| `GET /api/events/[id]/tickets/[token]` | token | | `{ ticket }` | 404 → page forgets the token |
| `GET /api/events/[id]/seats` | public | | `{ registeredCount, capacity }` | 404 → enrolled card hides "LIVE" and stops polling (it polls every 30 s) |
| `GET /api/me/event-registrations` | session | | `{ registrations: MyEventTicket[] }` | 401/404 → My bookings shows no event tickets |
| `POST /api/events/[id]/waitlist` | session | | `{ ok: true }` | 401 → sign-in popup · shown on the Readers enrolled card when sold out ("Join the waitlist") |
| `GET /api/events/[id]/waitlist` | session | | `{ waitlisted: boolean }` for the current account only | 401 when signed out |
| `DELETE /api/events/[id]/waitlist` | session | | `{ ok: true }` | "Undo" on the same card |

`Ticket` = `{ code, name, phoneMasked, status: "confirmed" | "cancelled", qrValue }`.
`ticketToken` is the secret in `?ticket=` links, so it must be unguessable.
`qrValue` should be the ticket link (`https://scene044.in/events/<slug>?ticket=<ticketToken>`):
the door scanner reads the token from it (`parseTicketQr`).

Rules the page relies on:

- Create re-checks the seat count and creates the Razorpay order with the price
  from the database (pattern: `app/api/razorpay/create-order`).
- Verify checks the signature **and** fetches the captured payment, as the
  venue `verify-payment` route does. Only then mark the registration confirmed
  and queue the WhatsApp ticket only when the guest opted in.
- A 15-minute hold and event-row locks protect the last seat. Repeated create requests reuse the stored order. A payment captured after its hold expires is rechecked against remaining capacity; if no seat exists, it is recorded as `payment_review` and no ticket is issued. SCENE must handle that payment manually.
- The WhatsApp confirmation includes the ticket link above.
- No email is sent. Email is collected for the organiser's records only.
- `POST /api/razorpay/webhook` requires raw-body HMAC with `RAZORPAY_WEBHOOK_SECRET`, and handles `payment.captured` / `order.paid`. It ignores unrelated venue orders. Duplicate callbacks are idempotent. My bookings also reconciles the account's pending orders; the optional persistent worker covers absent browsers.
- Public bearer passes expose only name, masked phone, code and QR. Shared URL tokens are not saved as the viewer's own ticket. Ticket-query visits do not initialise GA, and hosted pages use no-referrer metadata.

## 3. Organiser endpoints (`/api/host/events`)

All require the session **and** event-host approval for the event in the path
(section 0). Full phone and email appear only here.

| Call | Body | Success |
|---|---|---|
| `GET /api/host/events` | | `{ events: HostEvent[] }` — events this number may run, with `registeredCount` and `checkedInCount` |
| `GET /api/host/events/[id]/guests` | | `{ guests: HostGuest[] }` |
| `POST /api/host/events/[id]/checkin` | `{ token }` or `{ code }` | `{ guest, alreadyCheckedIn }`. A second check-in returns `alreadyCheckedIn: true` and does not change counts. 404 unknown, 409 cancelled. |
| `GET /api/host/events/[id]/reminders` | | `{ templates: ReminderTemplate[], history: ReminderSend[] }` |
| `POST /api/host/events/[id]/reminders` | `{ templateId }` | `ReminderSend`. Queues an approved template for confirmed, opted-in guests, once per event/template. Returns `pending`, not a fabricated delivery count. |
| `GET /api/host/events/[id]/payments` | | `MoneySummary` — verified capture records, actual recorded Razorpay fees, net, count, review count and payments. Unknown fees remain unknown. This is not a bank-settlement confirmation. |

Reminder templates need Meta approval (Utility category) before they can be
sent. This event outbox is separate from weekly digests and venue notifications. Configure:

```
RAZORPAY_KEY_ID=<matching test or live key>
RAZORPAY_KEY_SECRET=<matching secret>
RAZORPAY_WEBHOOK_SECRET=<matching dashboard webhook secret>
HOSTED_EVENT_PAYMENT_RECONCILIATION_ENABLED=true
WHATSAPP_HOSTED_EVENTS_ENABLED=true
WHATSAPP_EVENT_TEMPLATE_LANGUAGE=en
WHATSAPP_EVENT_TICKET_TEMPLATE_NAME=<approved name>
WHATSAPP_EVENT_DAY_BEFORE_TEMPLATE_NAME=<approved name>
WHATSAPP_EVENT_MORNING_OF_TEMPLATE_NAME=<approved name>
WHATSAPP_EVENT_DIRECTIONS_TEMPLATE_NAME=<approved name>
```

Each event template expects five body parameters: guest name, event title, date/time in IST, venue (full address for directions), ticket code; one dynamic URL button uses the fixed prefix `https://scene044.in/events/` with `<event-slug>?ticket=<token>` as the suffix. Names must point to templates actually approved by Meta; setting an environment variable alone is not approval. The default switches are off, and no template was submitted in this implementation.

STOP removes optional event WhatsApp consent; the worker rechecks it before sending. Accepted, delivered and read are tracked separately. Ambiguous provider sends are never blindly repeated. Automatic refunds, waitlist promotion, event creation by hosts and organiser bank payouts are not implemented; curator-managed launch and manual support remain required.

## Curator setup APIs

### Registration-confirmation template submission (12 November 2026)

`scene_event_registration_confirmed_v1` is APPROVED in the verified SCENE WhatsApp business account as an English (`en`) Utility template, Meta id `1626829511700108` (verified 12 November). Exact content/examples are versioned in `lib/eventRegistrationTemplate.ts`; the five positional body parameters match `eventNotifications.ts`: attendee name, event title, IST date/time, venue and ticket code. Its **View ticket** URL button uses the existing event slug plus private ticket token. No real attendee token is included in the submission example.

`scripts/submit-event-confirmation-template.ts --waba=<selected-account-id>` is read-only by default; `--submit` creates only this template if absent, never sends a message. It verifies that the selected business account contains the website's configured sender and reports `matchesDefinition` for its exact content/button contract, without printing/storing credentials. A timed-out submission must be resolved with a read-only lookup before any retry. The owner authorised enabling `WHATSAPP_HOSTED_EVENTS_ENABLED=true` on the website service only; the template name/language are saved alongside it. Verify the deployed runtime after rollout. Approval/configuration is not proof of end-to-end delivery; do not send test messages or manually backfill notifications.

- `GET/POST /api/admin/hosted-events`: load or save ticketing for an existing event. `action: "prepare-chapter-lounge"` prepares/reuses the real-content Arts draft with closed registration and zero attendees; it never publishes.
- `GET/POST /api/admin/event-hosts`: list event choices/access or approve `{eventId, label, phone}`. Requires curator authentication.
- `DELETE /api/admin/event-hosts/[id]`: revoke access without deleting registrations or payments.
- `GET /api/venue-auth/host-events`: public event names/IDs for sign-in, including published past events for post-event access; no draft titles or host mobile numbers.

Apply the new migration BEFORE deploying this code: shared sign-in and public feeds now read the new tables. Migration is idempotent, creates no event, and sends no messages.

## 4. Isolated frontend previews and backend tests

Run `npm run dev` (404 in production for all three):

- `/dev/hosted-event` — the event page on `mockRegistrationApi()`. Add `?seats=0`
  (first visitor) or `?seats=20` (full house, waitlist) to preview the other
  Readers enrolled states. Sign-in is
  simulated (signs in as a sample guest). Emails starting `soldout@` → sold
  out; `existing@` → already registered. The Razorpay sheet is a browser
  confirm box: OK pays, Cancel closes it.
- `/dev/my-bookings` — My bookings with the sample guest's ticket.
- `/dev/host-events` — the organiser workspace on `mockEventHostApi()`: 14
  readers, 3 already checked in, sample payments and reminder history.
