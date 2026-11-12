# Event Host Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guests register with the shared SCENE sign-in and find their tickets in My bookings; organisers run their event from `/host/events` in the venue host workspace's design.

**Architecture:** Registration reads the signed-in profile through a small `HostedAuth` context (bridged from `VenueAppProvider` on the real page, mocked on the dev page). Event tickets join `MyBookings` through one optional prop rendered by a new `EventTicketCard`. The organiser workspace is a new `EventHostWorkspace` built from the venue workspace's markup, on an API client with HTTP and mock implementations.

**Tech Stack:** Next.js 16.3, React 19, Tailwind v4 tokens, existing venue components (`AuthModal`, `VenueAppProvider`, `VenueShell`, `HostQrScanner`, figma `icons`). Tests: `node --import tsx` scripts.

**Spec:** `docs/superpowers/specs/2026-11-12-event-host-dashboard-design.md`

## Global Constraints

- Branch `feat/hosted-event-page` (continue). Commit identity `-c user.name=Scene044 -c user.email=support@scene044.in`.
- Venue Figma ports (`HostWorkspace.tsx`, `MyBookings.tsx`, `AuthModal.tsx`, `HostQrScanner.tsx`) change only additively: new optional props whose defaults keep today's behaviour exactly.
- `proxy.ts` and server auth are not changed (security-sensitive; backend work). The contract doc states what the backend must add.
- Workspace styling = venue workspace classes: `bg-sand`, `border-[1.5px] border-ink`, `shadow-hard*`, `font-head`, `font-mono(-b)`, `text-stone`, `text-flame`, `text-moss`, tab underline `border-flame`.
- Every WhatsApp send goes through a confirm dialog naming the audience count.
- Full phone and email appear only in the host workspace; guest-facing views use masked phone.
- Mobile first, 44px tap targets, no horizontal scroll at 375px.

## Review Focus

1. Signed-out guest swipes → sign-in popup → after verifying, the card continues to details without a second swipe (Task 2 test via reducer `prefill`).
2. Organiser number not approved (403) → workspace shows the "not set up" message, not an empty guest list (Task 5 test on `classifyLoadError`).
3. Same ticket scanned twice at the door → second scan says "already checked in", count unchanged (Task 4 test on mock).
4. Guest search with a phone fragment or lower-case code still matches (Task 4 test on `filterGuests`).
5. CSV with commas/quotes in names stays one row per guest (Task 4 test on `guestsCsv`).

---

### Task 1: Registration on the shared sign-in (client + reducer)

**Files:** Modify `lib/client/eventRegistration.ts`, `lib/client/registrationFlow.ts`, `scripts/test-event-registration.ts`, `scripts/test-registration-flow.ts`

**Interfaces — Produces:**
- `RegistrationApi.create(input: { name: string; email: string }): Promise<CreatedRegistration>`; `sendCode` removed.
- Mock triggers by email: `soldout@…` → 409 sold out; `existing@…` → 409 `existingTicketToken: "mock-existing"`.
- `validateDetails({ name, email })` (phone no longer validated here).
- Reducer: `FlowStep` loses `code_sent`; new action `{ type: "prefill"; details: { name: string; email: string; phone: string } }` sets details and moves `idle` → `details`.

- [ ] Update tests first (create body is `{ name, email }`, no `/otp` call; reducer: `prefill` from idle → details with values; `code_sent` gone), run → FAIL; implement; run `npm run -s test:hosted-event` → all PASS; commit `feat(events): registration uses the shared SCENE sign-in`.

### Task 2: Hosted page on the shared sign-in (UI)

**Files:** Create `components/scene/hosted/hostedAuth.tsx`; modify `HostedRegistration.tsx`, `HostedEventView.tsx`, `app/events/[slug]/page.tsx`, `app/dev/hosted-event/page.tsx`, `components/venues/figma/AuthModal.tsx`, `components/venues/figma/VenueApp.tsx`, `app/globals.css`

**Interfaces — Produces:**
- `HostedAuthProvider` / `useHostedAuth(): { profile: { name: string; phone: string; email?: string } | null; requireAuth(then: (p) => void): void }`.
- `VenueAuthBridge` (inside `VenueAppProvider`, maps `useVenueApp`) and `MockHostedAuth` (dev: signs in as "Asha Raman" on first request).
- `AuthModal` optional `copy?: { title: string; body: string }`; `VenueAppProvider.requireAuth(then, copy?)` passes it through. Defaults unchanged.
- `.venue-surface.hosted-root { background: var(--color-background) }` keeps the cream page.

- [ ] Card: swipe → `requireAuth(p => dispatch({ type: "prefill", details }))`; details step shows name + email inputs and the number read-only ("Signed in as +91 …"); submit "Continue to pay ₹299" → create → Razorpay. Remove the code field and resend.
- [ ] Verify: lint + tsc on touched files; browser `/dev/hosted-event` at 375px: swipe → (mock sign-in) → prefilled details → pay → printer → ticket. Commit `feat(events): hosted page signs guests in with the shared SCENE account`.

### Task 3: Event tickets in My bookings

**Files:** Create `lib/client/myEventTickets.ts`, `components/venues/figma/EventTicketCard.tsx`, `scripts/test-my-event-tickets.ts`; modify `components/venues/figma/MyBookings.tsx` (optional prop), `MyBookingsPage.tsx`

**Interfaces — Produces:**
- `MyEventTicket = { eventId: number; slug: string; title: string; posterImageUrl: string | null; startAt: string; endAt: string | null; venueName: string | null; ticket: Ticket; ticketToken: string }`.
- `fetchMyEventTickets(signal?): Promise<MyEventTicket[]>` (GET `/api/me/event-registrations`; 404 → `[]` so My bookings works before the backend exists).
- `splitEventTickets(tickets, now): { upcoming: MyEventTicket[]; past: MyEventTicket[] }` — past when `endAt` (or start + 2h) is before now; cancelled tickets go to past.
- `MyBookings` prop `eventTickets?: MyEventTicket[]`; tab counts include them; empty states show only when both lists are empty.
- `EventTicketCard({ t, i })`: BookingCard markup; poster, "Event ticket" kicker, title, date/time/venue meta, code, status, **View ticket** → `/events/<slug>?ticket=<token>`.

- [ ] Test `splitEventTickets` (upcoming, ended, cancelled, no endAt) → FAIL → implement → PASS. Build card + prop. Verify lint/tsc. Commit `feat(bookings): event tickets in My bookings`.

### Task 4: Event host API client and pure helpers

**Files:** Create `lib/client/eventHostApi.ts`, `scripts/test-event-host.ts`

**Interfaces — Produces:**
- Types `HostEvent { id; slug; title; posterImageUrl; startAt; endAt; venueName; capacity; registeredCount; checkedInCount; pricePaise }`, `HostGuest { code; ticketToken; name; phone; email; status: "confirmed" | "checked_in" | "cancelled"; registeredAt; checkedInAt: string | null }`, `ReminderTemplate { id; name; preview; audience: number; lastSentAt: string | null }`, `ReminderSend { id; templateName; sentAt; sent; delivered; failed }`, `MoneySummary { grossPaise; feesPaise; netPaise; paymentsCount; settlement: string; payments: { at; guest; amountPaise; paymentId; status: "captured" | "failed" | "refunded" }[] }`.
- `EventHostApi { listEvents(); guests(eventId); checkIn(eventId, { token } | { code }); reminders(eventId); sendReminder(eventId, templateId); money(eventId) }`, `httpEventHostApi()`, `mockEventHostApi()`.
- `filterGuests(guests, query, filter: "all" | "not_arrived" | "checked_in" | "cancelled")`, `guestsCsv(guests): string`, `parseTicketQr(text): string | null` (token from `…?ticket=<token>` on scene044.in/localhost or a bare token), `classifyLoadError(status: number): "signin" | "not_approved" | "error"`.

- [ ] Tests (search by name/code case-insensitive/last-4 phone; filters; CSV quoting; QR parsing; double check-in on mock returns `alreadyCheckedIn: true`; 401→signin, 403→not_approved) → FAIL → implement → PASS; add to `test:hosted-event`; commit `feat(host): event host API client and helpers`.

### Task 5: Event host workspace

**Files:** Create `components/venues/figma/EventHostWorkspace.tsx`, `app/host/events/page.tsx`, `app/dev/host-events/page.tsx`; modify `components/venues/HostQrScanner.tsx` (optional `onToken?: (text: string) => Promise<string>` returning the status message; default path unchanged)

**Interfaces — Consumes:** Task 4. **Produces:** `EventHostWorkspace({ api: "http" | "mock" })`.

- [ ] Header + tabs (Guests, Check in, Reminders, Money) copied from the venue workspace; event switcher when >1 event; 15 s polling; toasts.
- [ ] Guests: greeting, 3 stat cards, search + filter chips, guest rows, Download CSV. Check in: scanner (`onToken`) + code form + result card + "N of M checked in". Reminders: template cards with preview + audience + Send → confirm dialog → toast; history list. Money: 4 stat cards, settlement line, payments list.
- [ ] Load states: `signin` → button opening the shared sign-in; `not_approved` → message + WhatsApp SCENE link; `error` → retry.
- [ ] `/host/events`: `VenueShell bare` + workspace (`http`). `/dev/host-events`: same on `mock`, 404 in production.
- [ ] Verify lint/tsc; browser `/dev/host-events` at 375px and 1440px: all tabs, search, CSV download, reminder confirm, check-in by code twice. Commit `feat(host): event workspace for organisers`.

### Task 6: Contract and final review

- [ ] Update `docs/hosted-event-backend-contract.md`: session-based registration, `/api/me/event-registrations`, `/api/host/events*`, and the required `proxy.ts` / host-access change to admit approved event hosts to `/host/events` and `/api/host/events/*`.
- [ ] Final whole-branch review (fresh reviewer, most capable model) with Review Focus from both plans; fix Critical/Important with RED→GREEN; commit.
