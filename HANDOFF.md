# Handoff: hosted events (branch feat/hosted-event-page)

Everything is committed locally (not pushed). Tests: `npm run -s test:hosted-event`.
Previews (`npm run dev`): `/dev/hosted-event`, `/dev/my-bookings`, `/dev/host-events`.
Backend contract: `docs/hosted-event-backend-contract.md` (section 0: proxy.ts must admit approved event hosts to /host/events).
Specs/plans: `docs/superpowers/specs/2026-11-12-*`, `docs/superpowers/plans/2026-11-12-*`.

## Done since the first handoff
- Event page is black and red (`.hosted-dark` scope in app/globals.css); "Last time" and "About" are boxed; About folds behind "Read the full description".
- Reader pass: "Pay by UPI or card" removed; footer reads "After payment, you'll get your confirmation on WhatsApp." (green). Closing Razorpay shows no message.
- Host workspace: owner's dark "Guest list check-in" (EventGuestList.tsx) and "Day-before reminder WhatsApp" (EventReminderCard.tsx) designs are in; sends still go through the confirm dialog.
- Host workspace keeps the last loaded list if a refresh fails (banner), and Money loads separately.
- Cancelled events never offer booking; CSV export is formula-safe and always exports the full list.

## Still to do
1. Expired-session loop: on 401 from create, force the sign-in popup (`VenueAuthBridge.requireAuth` skips it when a stale client profile exists) and keep the error message (`HostedRegistration.tsx`, `hostedAuth.tsx`).
2. `?ticket=` links: don't persist URL tokens as "my ticket"; only clear the stored token if it is the one that failed; strip `?ticket=` via history.replaceState (`HostedRegistration.tsx`).
3. Contract: add Razorpay payment.captured webhook/reconciliation (no double charge after a lost verify), verify must check the registration belongs to the session, create must reject cancelled events.
4. Backend: proxy.ts must admit approved event hosts to /host/events (contract section 0).
5. Minors: RegisterBar smooth scroll under reduced motion; reading-specific copy ("Reader pass", "Bring any book", "Refreshments included") is hardcoded; workspace toast timer not cleared; ReadersEnrolled first poll doesn't update the big number.
