# Event host dashboard, shared sign-in and event tickets in My bookings

Date: 2026-11-12 · Status: draft for approval · Builds on
`2026-11-12-hosted-event-page-design.md`

## Intent

Chapter Lounge (the organiser) needs a Luma-style place to run their event:
see who's coming, check people in at the door, send WhatsApp reminders (there
is no email), and see the money Razorpay collected. Guests need to find their
ticket again in **My bookings**, next to their venue bookings.

Owner's direction: reuse the venue host workspace's components and style, and
the existing My bookings page. The organiser signs in through `/host` like a
venue host.

## Goals

- `/host/events`: an event workspace in the venue host workspace's design
  (sticky white header, flame-underlined tabs, ink-bordered hard-shadow stat
  cards, date-badge rows, check-in screen, toasts).
- Tabs: **Guests**, **Check in**, **Reminders** (WhatsApp), **Money** (Razorpay).
- Guests sign in with the shared SCENE sign-in (WhatsApp OTP) before paying,
  so every ticket is tied to their account and appears in `/bookings`.
- Works on a phone at the door (check-in is a phone task).

## Non-goals

- Editing the event (title, price, capacity) from the dashboard — curator does
  that for now.
- Refunds from the dashboard (terms say no refunds).
- Email of any kind.
- Changing the venue host workspace (`figma/HostWorkspace.tsx` is a verbatim
  Figma port; its docs say not to restructure it).

## Anti-goals

- Sending a WhatsApp message to every guest without a confirmation step.
- Showing a guest's full phone number or email to anyone but the approved
  organiser.
- Money figures that disagree with Razorpay.

## Decisions

### 1. Shared sign-in for registration (replaces the event OTP)

- The hosted event page is wrapped in `VenueAppProvider`, so it knows the
  signed-in profile.
- Swipe on the Reader pass → if signed out, the existing `AuthModal` opens
  (WhatsApp code, name, email). Then the card shows **Confirm your details**
  prefilled from the profile (name, email, number shown read-only) → swipe to
  pay → Razorpay → ticket printer.
- `AuthModal` gets one optional, additive prop for its heading/subcopy so it
  says "Sign in to get your pass" instead of "Join to request a booking". The
  default stays exactly as it is.
- The event's own OTP step is removed from the card and the contract.

### 2. Event tickets in My bookings

- `MyBookingsPage` also loads the signed-in user's event registrations and
  shows them in the **Upcoming** and **Past** tabs, sorted with venue bookings
  by date.
- They render as an **event ticket card** built from the venue `BookingCard`
  markup (same border, photo slot, meta rows, status pill): poster, title,
  date and time, venue, ticket code, status (Confirmed / Checked in /
  Cancelled), and **View ticket** → `/events/<slug>?ticket=<token>` (the page
  already shows the QR for that link).
- No pay / withdraw / review actions on event cards.

### 3. `/host/events` — the event workspace

Access: the organiser signs in with the shared sign-in (role Organiser). The
server checks their number is approved for at least one event (curator
approves numbers per event, like venue host access). Signed out → the sign-in
modal; signed in but not approved → a plain "This number isn't set up for an
event yet" message with a WhatsApp link to SCENE.

Header (venue workspace header): event poster thumbnail, event title, "Event
workspace" kicker, **Exit to site**. If the organiser has more than one event,
an event switcher sits under the title.

Tabs (venue workspace tab bar):

| Tab | Content |
|---|---|
| **Guests** (default) | Greeting + "Here's who's coming". Stat cards: Registered `14 / 20`, Checked in, Collected (₹). Search (name, phone last 4, code) and filter chips (All · Not arrived · Checked in · Cancelled). Guest rows in the "Upcoming confirmed" row style: initials badge, name, masked phone, email, ticket code, status pill (Paid · Checked in · Cancelled), registered time. **Download CSV** (built in the browser from the loaded list). |
| **Check in** | The venue check-in screen: QR scanner + "Or enter ticket code" + result card with **Confirm arrival**. `HostQrScanner` gets an optional `onToken` prop so it can check in event tickets; the venue default is unchanged. Live count "9 of 14 checked in". |
| **Reminders** | WhatsApp templates the backend offers (e.g. day-before reminder, morning-of reminder, directions), each with: preview text, audience ("14 confirmed guests"), last sent time. **Send** opens a confirm dialog ("Send to 14 guests on WhatsApp?") before anything goes out. Sent history below (time, template, sent / delivered / failed counts). |
| **Money** | Stat cards: Collected (gross), Razorpay fees, Net to you, Payments count. Settlement status line. Payments list: time, guest, amount, Razorpay payment ID, status (Captured / Failed / Refunded). All figures come from the backend, which reads Razorpay. |

Mobile: tabs scroll horizontally (as on the venue workspace), stat cards stack,
guest rows wrap, check-in is full-width.

Polling: the venue workspace polls every 15 s; the event workspace does the
same so door check-ins on two phones stay in sync.

### 4. Dev preview

`/dev/host-events` renders the workspace on a mock (14 guests, 3 checked in,
sample payments and reminder history), like `/dev/hosted-event`. 404 in
production.

## Backend contract (additions)

Documented in `docs/hosted-event-backend-contract.md`:

- Registration: `POST /api/events/[id]/registrations` now requires the SCENE
  session; body `{ name, email }` (phone comes from the session). The event
  OTP endpoint is dropped.
- `GET /api/me/event-registrations` → the signed-in user's tickets
  `{ registrations: { eventId, slug, title, posterImageUrl, startAt, endAt, venueName, ticket, ticketToken }[] }`.
- `GET /api/host/events` → events this number is approved for, with stats.
- `GET /api/host/events/[id]/guests` → guest list (full phone and email only
  here).
- `POST /api/host/events/[id]/checkin` `{ token | code }` → guest + new status.
- `GET /api/host/events/[id]/reminders` / `POST …/reminders` `{ templateId }`
  → templates, history, send result.
- `GET /api/host/events/[id]/payments` → totals and payments from Razorpay.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Organiser signs in via `/host`; separate `/host/events` workspace built from the venue workspace's parts | Matches Luma, scales to other organisers; needs per-event host approval on the backend |
| B | SCENE team only, inside the curator admin | Quickest access; organiser can't run their own door |

For registration identity: shared SCENE sign-in (chosen, so tickets reach My
bookings) vs. keeping the event's own OTP (sign-in free, but tickets can't be
found in My bookings).

## Left to the builder

File split, the mock's data, CSV columns, exact copy within the tone above.
