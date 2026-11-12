# Hosted Event Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `/events/[slug]` take registrations and ₹299 payments for SCENE-hosted events (first one: Chapter Lounge, 22 Nov 2026), mobile-first, in SCENE's existing look.

**Architecture:** The event page branches on `event.hosted`. Hosted rendering lives in `components/scene/hosted/`, driven by a pure registration reducer (`lib/client/registrationFlow.ts`) and an API client with an HTTP and a dev-mock implementation (`lib/client/eventRegistration.ts`). The backend endpoints are built separately against the contract in `docs/hosted-event-backend-contract.md`; until then a dev-only page renders the full flow on the mock.

**Tech Stack:** Next.js 16.3 (App Router, read `node_modules/next/dist/docs/` first), React 19, Tailwind v4 tokens in `app/globals.css`, framer-motion, `qrcode`, existing `lib/client/razorpay.ts` and `lib/client/ics.ts`. Tests are plain `node:assert` scripts run with `node --import tsx`.

**Spec:** `docs/superpowers/specs/2026-11-12-hosted-event-page-design.md`

## Global Constraints

- Branch first: `git switch -c feat/hosted-event-page` (never commit to `main`).
- Colours, fonts and shapes come only from the existing events tokens: `background`, `foreground`, `card`, `secondary`, `muted`, `primary`/`primary-ink`, `signal-ink`, `warn-ink`; `font-display` (black weight), `font-mono` kickers; `--radius: 0`, `border-2 border-foreground`, hard offset shadows. No venue tokens, no new fonts, no rounded corners.
- Mobile first. Inputs `text-base` (16px). Every tap target `min-h-11` (44px). No horizontal scroll at 375px.
- Motion: framer-motion under `<MotionConfig reducedMotion="user">`; transform and opacity only; step changes ~200ms, 8px rise.
- Never show "You're in" until the verify endpoint returns `{ ok: true, ticket }`.
- The client never sends an amount. Price shown comes from `hosted.pricePaise`.
- Hosted events hide the "Source / Checked by SCENE" line and "View original".
- Copy (exact): button `Register · ₹299`; helper `Pay by UPI or card · confirmation on WhatsApp`; confirming `Confirming your payment…`; confirmed note `We've sent your ticket on WhatsApp. Show this QR at the door.`
- Seat cap in the fixture: 20. Refund line in the fixture: `Can't make it? Message us on WhatsApp up to 24 hours before and we'll refund you.` (owner to confirm).

## Review Focus

1. Phone typed as `+91 98765 43210`, `098765 43210` or `98765-43210` is accepted as the same number; 9-digit or landline-looking input is rejected next to the field (Task 2 test).
2. Guest closes the Razorpay sheet or the payment fails: details are kept, the card returns to the pay step with a message, nothing claims they're registered (Task 3 test).
3. Payment succeeded but the verify call fails (network/502): card stays in "confirming" with a Retry and the Razorpay payment ID shown, never "payment failed" (Task 3 test).
4. Same phone registers twice: the 409 carries the existing ticket token and the card shows that ticket instead of charging again (Task 3 test).
5. A stored ticket token that is unknown or cancelled: storage is cleared and the normal open card shows (Task 2 + Task 3 tests).

---

### Task 1: Hosted event types, fixture and seat summary

**Files:**
- Create: `lib/hostedEvents.ts`
- Modify: `lib/events.ts:31-73` (add optional fields only)
- Test: `scripts/test-hosted-event.ts`; add `"test:hosted-event"` to `package.json` scripts (runs this and the Task 2/3 scripts)

**Interfaces:**
- Produces:
  - `export type RegistrationState = "open" | "sold_out" | "closed"`
  - `export interface HostedEventInfo { hostName: string; pricePaise: number; capacity: number; registeredCount: number; registrationState: RegistrationState; description: string; gallery: { src: string; alt: string }[]; quote: { text: string; by: string } | null; goodToKnow: string[]; refundPolicy: string }`
  - `PublicEvent.hostedPricePaise?: number | null` and `PublicEventDetail.hosted?: HostedEventInfo | null` in `lib/events.ts`
  - `export function seatSummary(hosted: HostedEventInfo, endAt: string | null, now?: Date): { state: RegistrationState | "ended"; spotsLeft: number; label: string }`
  - `export function formatRupees(paise: number): string` → `"₹299"`
  - `export const CHAPTER_LOUNGE_FIXTURE: PublicEventDetail & { hosted: HostedEventInfo }` (title, 2026-11-22 11:00–13:00 IST, Madras Adda, Mylapore address, poster and 7 gallery paths under `/events/chapter-lounge/`, the owner's description verbatim from the spec conversation, capacity 20, registeredCount 14)

- [ ] **Step 1: Write the failing test** `scripts/test-hosted-event.ts`:

```ts
assert.equal(formatRupees(29900), "₹299");
const h = { ...CHAPTER_LOUNGE_FIXTURE.hosted };
assert.deepEqual(seatSummary(h, END, BEFORE), { state: "open", spotsLeft: 6, label: "6 of 20 spots left" });
assert.equal(seatSummary({ ...h, registeredCount: 19 }, END, BEFORE).label, "1 spot left");
assert.equal(seatSummary({ ...h, registeredCount: 20 }, END, BEFORE).state, "sold_out");
assert.equal(seatSummary({ ...h, registeredCount: 25 }, END, BEFORE).spotsLeft, 0);
assert.equal(seatSummary({ ...h, registrationState: "closed" }, END, BEFORE).label, "Registration closed");
assert.equal(seatSummary(h, END, AFTER_END).state, "ended");
```
(`END = "2026-11-22T07:30:00.000Z"`, `BEFORE` = 2026-11-20, `AFTER_END` = 2026-11-22T08:00Z.)

- [ ] **Step 2: Run** `node --import tsx scripts/test-hosted-event.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `lib/hostedEvents.ts` and the two optional fields in `lib/events.ts`. Labels: `"N of C spots left"`, `"1 spot left"`, `"Sold out"`, `"Registration closed"`, `"This event has ended"`. Ended wins over every other state.
- [ ] **Step 4: Run** the test — Expected: `PASS hosted event seat summary`. Run `npx tsc --noEmit` — Expected: no errors.
- [ ] **Step 5: Commit** `feat(events): hosted event types, fixture and seat summary`

### Task 2: Registration API client, validation and ticket storage

**Files:**
- Create: `lib/client/eventRegistration.ts`
- Test: `scripts/test-event-registration.ts`

**Interfaces:**
- Consumes: `readStorage` / `writeStorage` from `lib/client/storage.ts`.
- Produces:
  - `export interface Ticket { code: string; name: string; phoneMasked: string; status: "confirmed" | "cancelled"; qrValue: string }`
  - `export interface CreatedRegistration { registrationToken: string; orderId: string; amount: number; currency: string; keyId: string }`
  - `export class RegistrationError extends Error { status: number; existingTicketToken?: string; soldOut?: boolean }`
  - `export interface RegistrationApi { sendCode(phone: string): Promise<void>; create(input: { name: string; email: string; phone: string; code: string }): Promise<CreatedRegistration>; verify(input: { registrationToken: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }): Promise<{ ticket: Ticket; ticketToken: string }>; getTicket(token: string): Promise<Ticket | null> }`
  - `export function httpRegistrationApi(eventId: number): RegistrationApi` — paths exactly as the contract table in the spec; non-2xx → `RegistrationError` with the body's `error` as message, `existingTicketToken` and `soldOut` copied from the body; `getTicket` returns `null` on 404.
  - `export function mockRegistrationApi(): RegistrationApi` — any code `"123456"` passes; phone ending `0000` → 409 sold out; phone ending `1111` → 409 with `existingTicketToken: "mock-existing"`; `verify` resolves after 800ms.
  - `export function normalizeIndianMobile(input: string): string | null` → 10 digits starting 6–9, or null.
  - `export function validateDetails(input: { name: string; email: string; phone: string }): Partial<Record<"name" | "email" | "phone", string>>` — messages: `Enter your name`, `Enter a valid email`, `Enter a 10-digit mobile number`.
  - `export function readStoredTicketToken(eventId: number): string | null`, `storeTicketToken(eventId: number, token: string): void`, `clearStoredTicketToken(eventId: number): void` (key `scene044:ticket:<eventId>`, version 1).

- [ ] **Step 1: Write the failing test**:

```ts
for (const raw of ["+91 98765 43210", "098765 43210", "98765-43210", "9876543210"]) assert.equal(normalizeIndianMobile(raw), "9876543210");
for (const raw of ["987654321", "4412345678", "", "+1 415 555 0172"]) assert.equal(normalizeIndianMobile(raw), null);
assert.deepEqual(validateDetails({ name: " ", email: "a@", phone: "123" }), { name: "Enter your name", email: "Enter a valid email", phone: "Enter a 10-digit mobile number" });
assert.deepEqual(validateDetails({ name: "Asha", email: "asha@example.com", phone: "98765 43210" }), {});
storeTicketToken(7, "tok"); assert.equal(readStoredTicketToken(7), "tok"); clearStoredTicketToken(7); assert.equal(readStoredTicketToken(7), null);
// http client: stub globalThis.fetch
// 409 { error: "Already registered", existingTicketToken: "t1" } → rejects RegistrationError with existingTicketToken "t1"
// GET ticket 404 → resolves null
// create() request body has no "amount" key
```
(Stub `window.localStorage` the way `scripts/test-booking-analytics.ts` does.)

- [ ] **Step 2: Run** `node --import tsx scripts/test-event-registration.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `lib/client/eventRegistration.ts`.
- [ ] **Step 4: Run** — Expected: `PASS event registration client`.
- [ ] **Step 5: Commit** `feat(events): registration API client, validation and ticket storage`

### Task 3: Registration flow reducer

**Files:**
- Create: `lib/client/registrationFlow.ts`
- Test: `scripts/test-registration-flow.ts`

**Interfaces:**
- Consumes: `Ticket`, `CreatedRegistration` (Task 2); `RegistrationState` (Task 1).
- Produces:
  - `export type FlowStep = "idle" | "details" | "code_sent" | "paying" | "confirming" | "confirmed" | "sold_out" | "closed" | "ended"`
  - `export interface FlowState { step: FlowStep; details: { name: string; email: string; phone: string }; registration: CreatedRegistration | null; paymentId: string | null; ticket: Ticket | null; message: string | null; busy: boolean }`
  - `export type FlowAction = { type: "open" } | { type: "edit"; field: "name" | "email" | "phone"; value: string } | { type: "code_sent" } | { type: "registration_created"; registration: CreatedRegistration } | { type: "payment_dismissed" } | { type: "payment_failed"; message: string } | { type: "payment_succeeded"; paymentId: string } | { type: "verify_failed"; message: string } | { type: "confirmed"; ticket: Ticket } | { type: "sold_out" } | { type: "busy"; busy: boolean } | { type: "error"; message: string }`
  - `export function initialFlow(seat: { state: RegistrationState | "ended" }, ticket: Ticket | null): FlowState`
  - `export function flowReducer(state: FlowState, action: FlowAction): FlowState`

- [ ] **Step 1: Write the failing test** covering:

```ts
// confirmed ticket on load wins; cancelled ticket → idle (open seat) with no ticket
assert.equal(initialFlow({ state: "open" }, ticket).step, "confirmed");
assert.equal(initialFlow({ state: "open" }, { ...ticket, status: "cancelled" }).step, "idle");
assert.equal(initialFlow({ state: "sold_out" }, null).step, "sold_out");
// editing phone after code sent goes back to details
// dismiss and failure keep details and return to "paying" with a message
let s = run(initial, open, edit name/email/phone, code_sent, registration_created);
assert.equal(s.step, "paying");
s = flowReducer(s, { type: "payment_dismissed" });
assert.equal(s.step, "paying"); assert.equal(s.details.name, "Asha"); assert.equal(s.message, "Payment not completed. Your details are saved — try again when ready.");
s = flowReducer(s, { type: "payment_failed", message: "Card declined" });
assert.equal(s.step, "paying"); assert.equal(s.message, "Card declined");
// verify failure after a captured payment stays in confirming with the payment id
s = flowReducer(flowReducer(s, { type: "payment_succeeded", paymentId: "pay_1" }), { type: "verify_failed", message: "Network" });
assert.equal(s.step, "confirming"); assert.equal(s.paymentId, "pay_1"); assert.equal(s.ticket, null);
// only "confirmed" sets the ticket
assert.equal(flowReducer(s, { type: "confirmed", ticket }).step, "confirmed");
// sold out mid-flow
assert.equal(flowReducer(s0Details, { type: "sold_out" }).step, "sold_out");
```

- [ ] **Step 2: Run** `node --import tsx scripts/test-registration-flow.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the reducer. `verify_failed` sets `message` to `We received your payment but couldn't confirm it yet. Retry, or message us with payment ID <paymentId>.`
- [ ] **Step 4: Run** — Expected: `PASS registration flow`. Run `npm run test:hosted-event` — all three PASS.
- [ ] **Step 5: Commit** `feat(events): registration flow reducer`

### Task 4: Registration card and mobile register bar

**Files:**
- Create: `components/scene/hosted/HostedRegistration.tsx` (client)
- Create: `components/scene/hosted/TicketView.tsx` (client)
- Create: `components/scene/hosted/RegisterBar.tsx` (client)

**Interfaces:**
- Consumes: Tasks 1–3; `openRazorpayCheckout` (`lib/client/razorpay.ts`); `downloadEventIcs`, `CalendarEventInput` (`lib/client/ics.ts`); `qrcode` `toDataURL`; `Btn`, `Mono` (`components/scene/ui.tsx`).
- Produces:
  - `export function HostedRegistration(props: { event: PublicEventDetail & { hosted: HostedEventInfo }; api: "http" | "mock"; anchorId: string }): JSX.Element` — reads `?ticket=` then `readStoredTicketToken`, fetches the ticket, builds `initialFlow`; on 404/cancelled clears storage. On confirmed: `storeTicketToken`.
  - `export function TicketView(props: { ticket: Ticket; event: PublicEventDetail }): JSX.Element` — QR image (alt `Ticket QR code for <name>`), code, `Add to calendar`, `Share`, `Can't make it? Message the host` (wa.me to `NEXT_PUBLIC_WHATSAPP_NUMBER`; hidden when unset).
  - `export function RegisterBar(props: { anchorId: string; priceLabel: string; hidden: boolean }): JSX.Element | null` — fixed bottom on `< sm` only, visible when the element `#anchorId` is out of view (IntersectionObserver), `pb-[env(safe-area-inset-bottom)]`; tapping scrolls to the anchor and dispatches the `open` action via a `hosted-register-open` CustomEvent the card listens for.

- [ ] **Step 1:** Read `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` and `02-guides/forms.md` for any v16 changes that affect client components and forms.
- [ ] **Step 2: Implement** the three components per the spec's card states (Open / details / code / pay / confirming / You're in / failed / sold out / closed / ended). Fields: visible `<label>`s, `autocomplete` `name` / `email` / `tel-national`, OTP `inputmode="numeric" autocomplete="one-time-code" maxLength={6}`, errors under each field with `aria-describedby`, `role="alert"` for flow messages. Wrap step content in `AnimatePresence` + `motion.div` (opacity, y 8→0).
- [ ] **Step 3: Verify** `npx tsc --noEmit` and `npm run lint` — Expected: no new errors in `components/scene/hosted/`.
- [ ] **Step 4: Commit** `feat(events): hosted registration card, ticket view and mobile register bar`

### Task 5: Hosted event view, assets, page integration and dev preview

**Files:**
- Create: `components/scene/hosted/HostedEventView.tsx` (server component: hero, poster, glance, card slot, About, gallery, Good to know, share/save)
- Create: `components/scene/hosted/HostedGallery.tsx` (client: scroll-snap row on mobile, 4-column grid `sm:` up, tap opens full image in a `<dialog>`)
- Create: `public/events/chapter-lounge/` — `poster.jpg` + `last-time-1..7.jpg` from the 8 shared images, resized with `sips -Z 1600` (poster `-Z 1400`)
- Create: `app/dev/hosted-event/page.tsx` — renders `HostedEventView` with `CHAPTER_LOUNGE_FIXTURE` and `api="mock"`; `notFound()` when `process.env.NODE_ENV === "production"`; `robots: { index: false }`
- Modify: `app/events/[slug]/page.tsx` — if `event.hosted`, return `<HostedEventView event={event} api="http" />` inside the existing header/footer/JSON-LD; otherwise unchanged
- Modify: `lib/client/sceneEvent.ts` — add `hostedGlanceFacts(event: PublicEventDetail & { hosted: HostedEventInfo }): GlanceFact[]` (When, Where + address hint, Price `₹299 · refreshments included`, Bring `Any book, poetry or your Kindle`)
- Modify: `components/scene/EventCard.tsx` — when `event.hostedPricePaise` is set, show a `Hosted · ₹299` badge in the existing badge row (primary-ink background)
- Test: extend `scripts/test-hosted-event.ts` with `hostedGlanceFacts(CHAPTER_LOUNGE_FIXTURE)` labels `["When", "Where", "Price", "Bring"]` and Price value `₹299 · refreshments included`

**Interfaces:**
- Consumes: Tasks 1–4; `EventGlance`, `StatusBadge`, `AlertsBanner`, `Btn` and existing page pieces.
- Produces: `export function HostedEventView(props: { event: PublicEventDetail & { hosted: HostedEventInfo }; api: "http" | "mock" }): JSX.Element`

- [ ] **Step 1:** Write the `hostedGlanceFacts` test; run — Expected: FAIL.
- [ ] **Step 2:** Implement `hostedGlanceFacts`; run — Expected: PASS.
- [ ] **Step 3:** Copy and resize the 8 images; check each is under 400 KB (`ls -lh public/events/chapter-lounge`).
- [ ] **Step 4:** Implement `HostedEventView`, `HostedGallery`, the dev page and the two page/card modifications. Layout follows the spec's "Page, top to bottom" list exactly; hero breadcrumb `Events / Hosted by SCENE`; poster: natural 4:5 under `sm`, `aspect-[21/9] object-contain bg-secondary` from `sm`; page bottom padding `pb-24 sm:pb-0` for the bar.
- [ ] **Step 5: Verify** `npx tsc --noEmit`, `npm run lint`, `npm run test:hosted-event`, and `npm run test:seo` (event page unchanged for non-hosted events) — Expected: all pass.
- [ ] **Step 6: Commit** `feat(events): hosted event page layout, gallery and dev preview`

### Task 6: Backend contract doc and browser verification

**Files:**
- Create: `docs/hosted-event-backend-contract.md` — the spec's contract section, with types pointed at `lib/hostedEvents.ts` and `lib/client/eventRegistration.ts`, plus the mock's test phones (`…0000` sold out, `…1111` already registered, code `123456`)

- [ ] **Step 1:** Write the contract doc.
- [ ] **Step 2:** Start the dev server via `.claude/launch.json` and open `/dev/hosted-event` in the browser pane.
- [ ] **Step 3:** At 375×812: no horizontal scroll (`document.documentElement.scrollWidth === innerWidth`); register bar appears after scrolling past the card; full mock flow reaches "You're in" with QR; dismissing checkout keeps details; phone `9876500000` shows sold out; `9876511111` shows existing ticket; reload shows the stored ticket.
- [ ] **Step 4:** At 768 and 1440: layout matches the spec, bar hidden, poster uncropped. Check console has no errors. Emulate `prefers-reduced-motion` and confirm steps switch without movement.
- [ ] **Step 5:** Run the ui-ux-pro-max pre-delivery checklist (`.claude/skills/ui-ux-pro-max/references/pro-rules.md`) against the page and fix findings.
- [ ] **Step 6: Commit** `docs(events): hosted event backend contract`
