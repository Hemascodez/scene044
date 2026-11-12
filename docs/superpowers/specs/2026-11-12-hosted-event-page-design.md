# Hosted event page: registration and payment (frontend)

Date: 2026-11-12 · Status: draft for approval

## Intent

SCENE/044 is hosting its first own event: **Let's do more reading** by Chapter
Lounge, Sunday 22 November 2026, 11 am to 1 pm, Madras Adda (Mylapore), ₹299.
Until now every event page pointed people elsewhere ("View original →"). This
one has to take the registration itself: name, phone, email, payment, and a
confirmation the guest can come back to.

This doc covers the **public event page only**. The host dashboard (guest list,
WhatsApp reminders, check-in, money collected via Razorpay) is the next design.
The backend is designed separately; the contract it must meet is at the end.

## Goals

- A visitor on a phone can go from the Scene feed to a paid, confirmed seat
  without leaving the page except for the Razorpay sheet.
- The page stays the existing event page (`/events/[slug]`): same URL, same
  layout, same SCENE colours and fonts. A hosted event looks like a SCENE
  event, not a different site.
- A returning guest sees "You're in" with their ticket, not a second Register
  button.
- Social proof from the previous session (photos, sticky-note feedback).

## Non-goals

- Host dashboard, reminders, check-in (next design).
- Email. There is no email provider; all confirmations and reminders go over
  WhatsApp.
- Multiple ticket types, coupons, group registration, waitlist.
- Changing the feed or category pages beyond a small "Hosted" badge.

## Anti-goals

- Telling someone they're registered before the server has verified the
  payment.
- A form that fights the phone keyboard (zoom on focus, tiny tap targets,
  content hidden under the keyboard or the sticky bar).
- Restyling SCENE: no new palette, no new fonts, no rounded cards.

## Constraints found in the code

- `/events/[slug]` (`app/events/[slug]/page.tsx`) is built for discovered
  events: provenance line, "View original" via `/api/go/[id]`.
- Events are categorised into tech/business fields only (`lib/fieldCards.ts`).
  A reading event has no field, so the hosted layout must not rely on one.
- Theme: `app/globals.css` events tokens (`background #f4f2ea`, `foreground
  #14130d`, `primary #ff2d16` + `primary-ink`, `signal-ink`, `warn-ink`,
  `card`, `secondary`, `muted`), `radius: 0`, 2px ink borders, hard offset
  shadows, `font-display` (Arial black), `font-mono` kickers.
- WhatsApp OTP (`/api/whatsapp/send-otp`, `verify-otp`) and Razorpay Checkout
  (`/api/razorpay/*`, `lib/razorpay.ts`) exist, but both routes are tied to
  venue-user sessions and venue bookings. Event registration needs its own
  guest endpoints (contract below).
- `qrcode` is already a dependency; `framer-motion` is the animation library
  (reduced motion respected).

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Hosted mode on the existing event page: same sections, the actions slot becomes a registration card | Least new surface, consistent with Scene; the wide 21:9 poster strip needs a portrait-poster treatment |
| B | Same URL, new Luma-style two-column layout scoped to hosted events | Closer to Luma, warmer, but a second visual language on the event route |
| C | Separate standalone route | Most freedom, but splits event URLs, feed links and SEO |

Chosen by the owner: A, in Scene's own colours and fonts, mobile-first.

## The design

### Page, top to bottom (mobile first, 375px)

1. **Header**: unchanged `SceneHeaderStatic`.
2. **Hero band** (ink background, as today):
   - Breadcrumb: `Events / Hosted by SCENE` (no field needed).
   - Badges: `Hosted by SCENE` (primary), `₹299`, and a seats badge:
     `6 spots left` (warn) / `Sold out` (primary-ink) / `Registration closed`.
   - Title, date line `Sun, 22 Nov · 11:00 am – 1:00 pm IST · Madras Adda`,
     byline `by Chapter Lounge`.
3. **Poster**: same bordered, hard-shadow frame, but for hosted events the
   poster keeps its own shape (the Chapter Lounge poster is 4:5). Mobile: full
   width at its natural ratio. Desktop: frame stays 21:9, poster sits
   `object-contain` on the `secondary` surface so the title is never cropped.
4. **At a glance** (`EventGlance`, reused): gist line, facts (When, Where with
   address, Price `₹299 · refreshments included`, Bring `Any book or Kindle`).
5. **Registration card** (`HostedRegistration`, new), in the slot where
   "View original" sits today, same `bg-secondary` bordered box:
   - *Open*: price large, `6 of 20 spots left`, primary button
     `Register · ₹299`, line `Pay by UPI or card · confirmation on WhatsApp`.
   - *Register* expands **inline in the card** (not a modal, so it works with
     the phone keyboard and back button):
     1. Name, Email, WhatsApp number (`+91` prefix, `inputmode="tel"`,
        16px inputs, visible labels, errors under the field).
     2. `Send code` → 6-digit code field (`inputmode="numeric"`,
        `autocomplete="one-time-code"`), resend after cooldown.
     3. `Pay ₹299` opens Razorpay Checkout prefilled with name, email, phone.
     4. While the server verifies: `Confirming your payment…` (button stays
        disabled; no success shown yet).
   - *You're in*: signal-ink kicker, guest name, ticket code, QR (from
     `qrcode`), `Add to calendar` (.ics download, generated client-side),
     `Share`, note `We've sent your ticket on WhatsApp. Show this QR at the
     door.`, and a quiet `Can't make it? Message the host` WhatsApp link.
   - *Payment failed / dismissed*: card returns to step 3 with a plain
     message and `Try again`; details kept.
   - *Sold out* / *Closed* / *Event ended*: no button, one line of copy.
6. **About**: the full description as paragraphs (the owner's text), plain
   text, no markdown rendering.
7. **Last time at Chapter Lounge**: 7 photos from the previous session.
   Mobile: horizontal scroll-snap row (peek of the next photo); desktop: grid.
   Each photo `loading="lazy"`, real alt text, tap opens it full size.
   One pull-quote from the feedback notes beneath ("Very calm and warm
   space…").
8. **Good to know**: what to bring, refreshments, venue address with a Maps
   link, refund line (copy to be confirmed by owner, see below).
9. **Share / Save row** (existing `Btn`s), then `AlertsBanner`, footer.

Not shown for hosted events: the "Source / Checked by SCENE" provenance line
and "View original".

### Mobile behaviour

- A **sticky bottom bar** (`₹299 · Register`) appears once the registration
  card has scrolled out of view and hides while the card is on screen or the
  form is open; it scrolls to and opens the card. Safe-area padding at the
  bottom; page gets matching bottom padding so nothing hides under it.
- All tap targets at least 44px; inputs 16px so iOS doesn't zoom.
- Tested at 375, 768, 1024 and 1440px; no horizontal scroll.

### Returning guests

After a verified payment the server returns a ticket token. The page stores it
in `localStorage` (per event) and also puts a link to the ticket in the
WhatsApp confirmation (`/events/[slug]?ticket=<token>`). On load, if either is
present the card fetches the ticket and shows *You're in*.

### Motion

`framer-motion`, under `MotionConfig reducedMotion="user"`: the card's step
changes cross-fade with a small rise (8px, ~200ms), the sticky bar slides up.
Transform and opacity only.

### Feed

`EventCard` gets a small `Hosted · ₹299` badge so the event stands out in the
feed. No other feed change.

## Backend contract (for the backend design)

Event data, added to what `getPublicEventById` returns for hosted events:

```ts
hosted: {
  hostName: string;             // "Chapter Lounge"
  pricePaise: number;           // 29900
  capacity: number;             // e.g. 20
  registeredCount: number;      // paid + confirmed
  registrationState: "open" | "sold_out" | "closed";
  description: string;          // full About text
  gallery: { src: string; alt: string }[];
  goodToKnow: string[];
} | null
```

Endpoints the page calls (names are a proposal; shapes are what the UI needs):

| Call | Body | Returns |
|---|---|---|
| `POST /api/events/[id]/registrations/otp` | `{ phone }` | `{ ok }` · 429 with message on cooldown |
| `POST /api/events/[id]/registrations` | `{ name, email, phone, code }` | `{ registrationToken, orderId, amount, currency, keyId }` · 409 sold out / already registered (with existing ticket token) |
| `POST /api/events/[id]/registrations/verify` | `{ registrationToken, razorpay_order_id, razorpay_payment_id, razorpay_signature }` | `{ ok, ticket }` |
| `GET /api/events/[id]/tickets/[token]` | | `{ ticket }` |

`ticket = { code, name, phoneMasked, status: "confirmed" | "cancelled", qrValue }`.

Error bodies are `{ error: string }` with human copy the UI can show as-is.
Price always comes from the server; the client never sends an amount.

Until those endpoints exist the frontend runs against a local mock adapter
(dev only) so the page can be reviewed end to end.

## Open items for the owner

- Seat cap: assumed **20** (Madras Adda holds 15–20).
- Refund line: proposed "Can't make it? Message us on WhatsApp up to 24 hours
  before and we'll refund you." Confirm or replace.
- Photos: the 7 previous-session photos you shared are used with faces
  visible. Confirm the people in them are fine being on the public page.

## Left to the builder

Component file split, the mock adapter's shape, exact copy polish within the
tone above, and the `.ics` details.
