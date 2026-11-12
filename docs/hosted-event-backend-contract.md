# Hosted events: backend contract

The public event page for SCENE-hosted events is built (`components/scene/hosted/`).
It needs the backend below. Types live in code, so this doc points at them
rather than copying them:

- Event data: `HostedEventInfo` in `lib/hostedEvents.ts`
- Calls and ticket: `RegistrationApi`, `Ticket`, `CreatedRegistration` in
  `lib/client/eventRegistration.ts`

Design: `docs/superpowers/specs/2026-11-12-hosted-event-page-design.md`.

## 1. Event data

`getPublicEventById` (detail) must return `hosted: HostedEventInfo` for hosted
events and `null`/absent for every other event. The page switches layout on
that field alone.

| Field | Notes |
|---|---|
| `hostName` | "Chapter Lounge" |
| `pricePaise` | 29900. The only price the page shows; the client never sends an amount. |
| `capacity`, `registeredCount` | Count only paid, confirmed registrations. |
| `registrationState` | `open` / `sold_out` / `closed`. The page also treats `registeredCount >= capacity` as sold out and a past `endAt` as ended. |
| `description` | Plain text; blank line between paragraphs. Never rendered as HTML. |
| `gallery` | `{ src, alt }[]`. The Chapter Lounge photos are already at `/events/chapter-lounge/last-time-1..7.jpg`. |
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

## 2. Endpoints

All bodies are JSON. Errors are `{ error: string }` with copy the page shows
as is.

| Call | Body | Success | Errors the page handles |
|---|---|---|---|
| `POST /api/events/[id]/registrations/otp` | `{ phone }` (10 digits) | `{ ok: true }` | 400 bad number · 429 cooldown (message shown) |
| `POST /api/events/[id]/registrations` | `{ name, email, phone, code }` | `CreatedRegistration` = `{ registrationToken, orderId, amount, currency, keyId }` | 400 wrong code · 409 `{ soldOut: true }` · 409 `{ existingTicketToken }` when this phone already has a confirmed ticket |
| `POST /api/events/[id]/registrations/verify` | `{ registrationToken, razorpay_order_id, razorpay_payment_id, razorpay_signature }` | `{ ticket, ticketToken }` | any non-2xx: page keeps "Payment received" with Retry and the payment ID |
| `GET /api/events/[id]/tickets/[token]` | | `{ ticket }` | 404 → page forgets the token |

`Ticket` = `{ code, name, phoneMasked, status: "confirmed" | "cancelled", qrValue }`.
`qrValue` is what the door scanner reads; `ticketToken` is the secret in
`?ticket=` links, so it must be unguessable.

Rules the page relies on:

- Create re-checks the code and the seat count, and creates the Razorpay order
  with the price from the database (pattern: `app/api/razorpay/create-order`).
- Verify checks the signature **and** fetches the captured payment, as the
  venue `verify-payment` route does. Only then mark the registration confirmed
  and send the WhatsApp ticket.
- Hold a seat while an order is pending for a short window, so two people
  can't pay for the last seat.
- The WhatsApp confirmation should include
  `https://scene044.in/events/<slug>?ticket=<ticketToken>`; the page shows the
  ticket when opened from that link.
- No email is sent. Email is collected for the host's records only.

## 3. Trying the page before the backend exists

Run `npm run dev` and open `/dev/hosted-event` (404 in production). It uses
`mockRegistrationApi()`:

- Code `123456` passes; anything else is "wrong code".
- Phone ending `0000` → sold out. Ending `1111` → already registered (shows a
  ticket).
- The Razorpay sheet is a browser confirm box: OK pays, Cancel closes it.
