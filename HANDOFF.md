# Handoff: hosted events (branch feat/hosted-event-page)

Everything is committed locally (not pushed). Tests: `npm run -s test:hosted-event`.
Previews (`npm run dev`): `/dev/hosted-event`, `/dev/my-bookings`, `/dev/host-events`.
Backend contract: `docs/hosted-event-backend-contract.md` (section 0: proxy.ts must admit approved event hosts to /host/events).
Specs/plans: `docs/superpowers/specs/2026-11-12-*`, `docs/superpowers/plans/2026-11-12-*`.

## Done in the last pass
- Readers enrolled + Reader pass: black drop shadow removed; "Save your seat" removed.
- Cancelled events never offer booking (`seatSummary(..., eventStatus)`).
- Guest CSV escapes formula starters (= + - @) so +91 numbers stay text.

## Still to do (from the final review and the owner's last request)
1. Port the owner's designs into the host workspace (`components/venues/figma/EventHostWorkspace.tsx`):
   - "Guest list check-in" (dark card: check-in header with seat segments, filter chips with counts, search, per-guest card with a Check in button). Source zip: ~/Downloads/Guest list check-in-html.zip.
   - "Day-before reminder WhatsApp" (dark card with WhatsApp chat preview, avatars, send button with fill). Source: ~/Downloads/Day-before reminder WhatsApp-html.zip. Keep the "Send to N guests?" confirm dialog; no fake per-guest progress count.
   - Use SCENE fonts (Montserrat / Space Mono / Work Sans) and square corners, as the other dark cards do.
2. Expired-session loop: on 401 from create, force the sign-in popup (`VenueAuthBridge.requireAuth` skips it when a stale client profile exists) and keep the error message (`HostedRegistration.tsx`, `hostedAuth.tsx`).
3. Host workspace: once loaded, a failed poll must not hide the guest list/check-in; show a non-blocking banner and load Money separately (`EventHostWorkspace.tsx` refresh).
4. `?ticket=` links: don't persist URL tokens as "my ticket"; only clear the stored token if it is the one that failed; strip `?ticket=` via history.replaceState (`HostedRegistration.tsx`).
5. Contract: add Razorpay payment.captured webhook/reconciliation (no double charge after a lost verify), verify must check the registration belongs to the session, create must reject cancelled events.
6. Minors: RegisterBar smooth scroll under reduced motion; guest rows show full phone (rename/mask); reading-specific copy ("Reader pass", "Bring any book", "Refreshments included") hardcoded; workspace toast timer not cleared; ReadersEnrolled first poll doesn't update the big number.
