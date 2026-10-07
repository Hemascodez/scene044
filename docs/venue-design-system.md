# Venue pages: the Figma Make design

The venue pages are the approved Figma Make prototype, ported **verbatim**.
They are not a re-interpretation of it: the prototype's own components live in
`components/venues/figma/`, and its content (copy, photos, testimonials, fit
scores, amenities, house rules) is the owner's real content.

| Route | Component |
|---|---|
| `/venues` | `figma/Landing.tsx` |
| `/venues/time-cafe` | `figma/VenueDetail.tsx` (other venues fall back to `VenueDetail.tsx`) |
| `/venues/partner` | `figma/VenuePartner.tsx` |
| `/bookings` | `figma/MyBookings.tsx` via `figma/MyBookingsPage.tsx` (real data) |
| `/host` | `figma/HostWorkspace.tsx` via `figma/HostWorkspacePage.tsx` (real data) |
| `/venues/search`, `/host/checkin/[token]` | no design of their own — wrapped in the prototype header/footer (`VenueChrome`) |

## How the port was done (and how to keep it faithful)

The prototype source was copied with **mechanical changes only**:

1. Asset imports/paths → `/venues/figma/*` (re-encoded: 88 MB → ~27 MB).
2. The prototype's `muted` text colour (#66625d) is `stone` here — this app's
   `muted` is a surface colour.
3. `font-display` / `font-display-i` → `font-p-display` / `font-p-display-i`
   (the events theme owns `font-display`).
4. `"use client"`.

Everything else is the prototype's markup. When changing a venue page, edit the
file in `figma/` and compare against the prototype; avoid "re-styling" with
this app's generic venue tokens — that is how fidelity was lost before.

Tokens (`paper`, `ink`, `flame`, `moss`, `sand`, `line`, `stone`, `danger`,
`shadow-hard*`), the font utilities (`font-head`, `font-mono-b`, `font-body-m`…
with explicit weights, since the fonts are variable) and the prototype's motion
classes (`reveal`, `rise`, `press`, `anim-*`, `hiw-*`, `rf-*`, trust icons) are
in `app/globals.css`, scoped to `.venue-surface`.

### Verified fidelity

At 1440px the live landing and venue pages have **the same rendered height as
the prototype** (5445px and 6379px) and match slice-for-slice.

## What is wired to the real backend

- **Booking request** (venue page): real `POST /api/venue-bookings`, after
  real WhatsApp OTP sign-in (`figma/AuthModal.tsx` → `/api/whatsapp/*`). The
  modal adds one field the prototype lacked: email, which the booking API
  requires.
- **Pricing**: organisers pay only the listed space cost (`lib/venues.ts`
  `amountDue`), shown on the booking card and charged by
  `/api/razorpay/create-order`. Host payout stays 90% of the space cost;
  SCENE's 10% commission is deducted on the host side.
- **My bookings**: real bookings, real Razorpay payment, the real check-in QR,
  real **withdraw** (`DELETE /api/venue-bookings/[token]`, only while
  `requested` — `withdrawRequestedBooking`), reviews sent to the curator queue.
- **Host workspace**: real requests, approve/decline, check-in by code,
  calendar (bookings + manual blocks), payouts and demand — all counted from
  real bookings. Still behind the curator login (`proxy.ts`).

## Venue data: run the seed once in production

The prototype's spaces and prices are now the catalog constant in
`lib/venues.ts` (`TIME_CAFE`): First-floor ₹2,000, **Korean table ₹1,000 (new
space)**, Conversation table ₹400, Terrace ₹1,500, plus the prototype's house
rules and the two new event types. The live database only changes when you run:

    npx tsx --env-file=<prod env file> scripts/seed-venues.ts --force

(or make the same edits in the curator). Until then the Korean table appears on
the page but its booking request is rejected as an unknown space. The seed never
deletes rows: hide the old "Small talk table" in the curator if you want it gone.

## Deliberate departures from the prototype

- The request tracker says "In queue · On host's dashboard" instead of
  "Notified · Host alerted", and its overdue copy does not claim "we've nudged
  the host": the backend does neither.
- "Slot held until 23:45 tonight" → "Slot held for 24 hours" (the real hold).
- The host request breakdown reads Booking value − SCENE fee (10%) = payout,
  matching the real 90% payout rule (the prototype's "8% of organiser pays"
  maths contradicted it).
- Host requests, check-in, calendar and payouts use live data instead of the
  prototype's sample requests and fixed September figures.
- The prototype-only "Preview empty state" toggle in host reviews is removed.
- Inputs render at the designed 13–14px; only iOS phones get a 16px floor, to
  stop Safari zooming into focused fields.
