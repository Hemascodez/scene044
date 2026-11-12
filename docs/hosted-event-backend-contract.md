# Hosted events: backend contract

The frontend for SCENE-hosted events is built: the public event page
(`components/scene/hosted/`), event tickets in My bookings, and the
organiser's event workspace (`/host/events`). It needs the backend below.
Types live in code, so this doc points at them rather than copying them:

- Event data: `HostedEventInfo` in `lib/hostedEvents.ts`
- Guest calls and ticket: `RegistrationApi`, `Ticket`, `CreatedRegistration` in
  `lib/client/eventRegistration.ts`
- My bookings: `MyEventTicket` in `lib/client/myEventTickets.ts`
- Organiser calls: `EventHostApi` and its types in `lib/client/eventHostApi.ts`

Designs: `docs/superpowers/specs/2026-11-12-hosted-event-page-design.md`,
`docs/superpowers/specs/2026-11-12-event-host-dashboard-design.md`.

## 0. Required before launch: let event hosts through `/host`

`proxy.ts` guards everything under `/host` and `/api/host` and only admits
curators and **approved venue hosts** (`checkHostAccess`). Anyone else is
redirected to `/host/login` (which needs a venue). So an organiser like Chapter
Lounge cannot open `/host/events` today.

The backend must:

1. Store approved event-host numbers per event (like `venue_host_access`),
   managed by the curator.
2. Extend the proxy so `/host/events` and `/api/host/events/*` also admit a
   signed-in SCENE user whose number is an approved host of at least one event
   (the venue rules for other `/host` paths stay as they are).
3. Enforce it again in every `/api/host/events/*` handler, per event id: a
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
itself (calendar files and `/api/go/[id]` use it). There is no books or
community category today: pick or add one; the hosted page never shows it.

## 2. Guest endpoints

Guests sign in with the **shared SCENE sign-in** (the existing WhatsApp OTP,
`/api/whatsapp/*`, session cookie) before registering. There is no
event-specific OTP. All bodies are JSON; errors are `{ error: string }` with
copy the page shows as is.

| Call | Auth | Body | Success | Errors the page handles |
|---|---|---|---|---|
| `POST /api/events/[id]/registrations` | session | `{ name, email }` (phone comes from the session) | `CreatedRegistration` = `{ registrationToken, orderId, amount, currency, keyId }` | 401 → reopens sign-in · 409 `{ soldOut: true }` · 409 `{ existingTicketToken }` when this account already holds a confirmed ticket |
| `POST /api/events/[id]/registrations/verify` | session | `{ registrationToken, razorpay_order_id, razorpay_payment_id, razorpay_signature }` | `{ ticket, ticketToken }` | any non-2xx: page keeps "Payment received" with Retry and the payment ID |
| `GET /api/events/[id]/tickets/[token]` | token | | `{ ticket }` | 404 → page forgets the token |
| `GET /api/events/[id]/seats` | public | | `{ registeredCount, capacity }` | 404 → enrolled card hides "LIVE" and stops polling (it polls every 30 s) |
| `GET /api/me/event-registrations` | session | | `{ registrations: MyEventTicket[] }` | 401/404 → My bookings shows no event tickets |

`Ticket` = `{ code, name, phoneMasked, status: "confirmed" | "cancelled", qrValue }`.
`ticketToken` is the secret in `?ticket=` links, so it must be unguessable.
`qrValue` should be the ticket link (`https://scene044.in/events/<slug>?ticket=<ticketToken>`):
the door scanner reads the token from it (`parseTicketQr`).

Rules the page relies on:

- Create re-checks the seat count and creates the Razorpay order with the price
  from the database (pattern: `app/api/razorpay/create-order`).
- Verify checks the signature **and** fetches the captured payment, as the
  venue `verify-payment` route does. Only then mark the registration confirmed
  and send the WhatsApp ticket.
- Hold a seat while an order is pending for a short window, so two people
  can't pay for the last seat.
- The WhatsApp confirmation includes the ticket link above.
- No email is sent. Email is collected for the organiser's records only.

## 3. Organiser endpoints (`/api/host/events`)

All require the session **and** event-host approval for the event in the path
(section 0). Full phone and email appear only here.

| Call | Body | Success |
|---|---|---|
| `GET /api/host/events` | | `{ events: HostEvent[] }` — events this number may run, with `registeredCount` and `checkedInCount` |
| `GET /api/host/events/[id]/guests` | | `{ guests: HostGuest[] }` |
| `POST /api/host/events/[id]/checkin` | `{ token }` or `{ code }` | `{ guest, alreadyCheckedIn }`. A second check-in returns `alreadyCheckedIn: true` and does not change counts. 404 unknown, 409 cancelled. |
| `GET /api/host/events/[id]/reminders` | | `{ templates: ReminderTemplate[], history: ReminderSend[] }` |
| `POST /api/host/events/[id]/reminders` | `{ templateId }` | `ReminderSend`. Sends the Meta-approved WhatsApp template to every confirmed guest. The UI already asks "Send to N guests on WhatsApp?" first; the server should still rate-limit repeats. |
| `GET /api/host/events/[id]/payments` | | `MoneySummary` — read from Razorpay (orders for this event): gross, fees, net, count, settlement line, payments list |

Reminder templates need Meta approval (Utility category) before they can be
sent; see `docs/whatsapp-templates.md`.

## 4. Trying it before the backend exists

Run `npm run dev` (404 in production for all three):

- `/dev/hosted-event` — the event page on `mockRegistrationApi()`. Sign-in is
  simulated (signs in as a sample guest). Emails starting `soldout@` → sold
  out; `existing@` → already registered. The Razorpay sheet is a browser
  confirm box: OK pays, Cancel closes it.
- `/dev/my-bookings` — My bookings with the sample guest's ticket.
- `/dev/host-events` — the organiser workspace on `mockEventHostApi()`: 14
  readers, 3 already checked in, sample payments and reminder history.
