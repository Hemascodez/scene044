# Handoff: hosted events (branch feat/hosted-event-page)

Claude's frontend commits are preserved through `1c1139f`, including the in-view handwritten note, black-first background, frosted cards and dark glass map button. Combined release `5fcd5bd` was pushed to main and Railway confirmed success on 12 November. Its startup migrations completed and the public home, venues, weekly guide and host sign-in respond successfully; unauthenticated private APIs return 401.
Tests: `npm run -s test:hosted-event`, `npm run -s test:hosted-event-backend`, `npm run -s test:venue-auth`, curator/Intercity/SEO/digest suites and TypeScript pass. The configured Railway production build (`npm run build -- --webpack`) passes; an extra default Turbopack build stalled in this sandbox and was stopped.
Previews (`npm run dev`): `/dev/hosted-event`, `/dev/my-bookings`, `/dev/host-events`.
Backend contract: `docs/hosted-event-backend-contract.md` (section 0: proxy.ts must admit approved event hosts to /host/events).
Specs/plans: `docs/superpowers/specs/2026-11-12-*`, `docs/superpowers/plans/2026-11-12-*`.

## Done since the first handoff
- Event page is black and red (`.hosted-dark` scope in app/globals.css); "Last time" and "About" are boxed; About folds behind "Read the full description".
- Reader pass: "Pay by UPI or card" removed; footer describes My bookings and optional WhatsApp confirmation. Closing Razorpay shows no message.
- Host workspace: owner's dark "Guest list check-in" (EventGuestList.tsx) and "Day-before reminder WhatsApp" (EventReminderCard.tsx) designs are in; sends still go through the confirm dialog.
- Host workspace keeps the last loaded list if a refresh fails (banner), and Money loads separately.
- Cancelled events never offer booking; CSV export is formula-safe and always exports the full list.

## Backend implemented locally (12 November)
- Arts category in discovery, curator options, categorisation and alert interests. Reading event starts with zero registrations, retaining the supplied real content/photos.
- Independent `SCENE hosted` feed chip and card badge; hosting is a booking format, not an Arts topic replacement.
- `/admin/curator/hosting`: select an existing event, configure ticketing and approve/revoke a host name + verified mobile number for that event. Explicit Chapter Lounge draft preparation is repeatable and never publishes.
- Shared OTP sign-in accepts Event or Venue; proxy and every event API check current per-event approval. Revocation applies to existing sessions; venue permissions remain separate.
- Server-priced Razorpay orders, 15-minute seat holds, stored-order reuse, session-bound signature/capture verification, signed webhook and optional reconciliation worker. Late captured payments without a seat go to review, never to an oversold ticket. No automatic refunds or organiser transfers.
- Real tickets in My bookings, masked bearer-ticket lookup, protected guest/CSV data, idempotent check-in, persistent waitlist and actual capture/fee reports. Unknown fees are not fabricated; payout is explicitly coordinated separately.
- Opt-in-only WhatsApp outbox and reminder queue, approved-template/enable switches, delivery receipts, STOP handling, uncertain-send protection and duplicate prevention. New event templates have NOT been submitted/approved or enabled.
- Expired sign-in retry, shared-ticket storage isolation, ticket-query cleanup and analytics/referrer protection are implemented. First seat poll updates the count. Claude's first-visitor/full-house/waitlist UI is retained.
- Isolated PGlite integration tests run the actual SQL and routes with all payment/Meta calls intercepted. They never read `.env.local` or connect to production.
- TypeScript excludes unrelated untracked skill/project bundles (`inkloom` etc.) so their Cloudflare globals don't contaminate the app. Those files are otherwise untouched.

## Production activation / remaining gates
1. Railway startup applied `db/migrations/2026-11-12-hosted-events.sql` after the existing migrations. Curator ticketing/access APIs were verified against production after deployment.
2. The local Razorpay test-order connectivity request returned `401 Authentication failed` and created no order/charge. User could not edit `.env.local` and explicitly asked us to stop payment checks: they say production has the correct keys and will test the live purchase themselves. No further payment-provider requests should be made without a new request. Production keys were not inspected or changed; live payment success remains unverified.
3. Production `RAZORPAY_WEBHOOK_SECRET` and `HOSTED_EVENT_PAYMENT_RECONCILIATION_ENABLED` are absent. Browser signature/capture verification is implemented, but webhook recovery and the optional provider reconciliation worker are not enabled. Owner still needs to verify the live purchase. No Razorpay requests were made during deployment.
4. Owner requested a confirmation template. `scene_event_registration_confirmed_v1` (English, Utility, five body parameters, View ticket URL button) was submitted to Meta, id `1626829511700108`, and last checked PENDING. Template name/language were saved on the website service without redeploy; sending remains disabled until approval. No attendee messages were sent. See `docs/hosted-event-backend-contract.md` and `lib/eventRegistrationTemplate.ts`.
5. After explicit owner approval to publish, the real Chapter Lounge event was published as `/events/let-s-do-more-reading-164`: Arts, ₹299, 20 seats, 22 November 2026 11am–1pm IST at Madras Adda. Production registered count is zero. Sadhana's owner-supplied number is approved for this event only (do not commit her number). Registration is open; host sign-in can now select this published event. No registrations/payments were created for verification.
6. Refund operations and actual organiser payouts remain manual, not automatic. A payment-review record requires SCENE support before any ticket or payout.

## Local review
An isolated production-build preview was opened at `http://localhost:3016/` (real supplied event content, in-memory database, zero attendees). Its bootstrap is in a temporary directory outside the repository; real Razorpay/Meta calls and all background notification workers are blocked. This does not replace or stop the existing Claude dev server on port 3000. The temporary preview does not persist data or make real registrations.

## SCENE rebrand (same local work)
The owner supplied `Downloads/Scene logo-html.zip` and renamed the visible brand from SCENE/044 to SCENE. `components/brand/SceneLogo.tsx` ports its ticket-shaped wordmark, light/dark/red variants and twinkles; `SceneAppIcon.tsx` supplies the matching static lowercase-s icon for browser/install icons. The logo uses self-hosted Bricolage Grotesque from Fontsource; Work Sans and Space Mono elsewhere are unchanged. Intro motion finishes within five seconds and is disabled for reduced motion. The mockup's vendor scripts and remote Google Fonts runtime are not copied.

Public/venue/booking/partner/admin logos, ticket printer, display copy, page titles, schema site name and PWA name now say SCENE. Existing URLs (`scene044.in`), storage keys, database records, SCN booking references, provider/template IDs, calendar identifiers and real event posters/photos remain intact. Previously approved Meta templates or already-sent messages can still contain old static branding; no external template update was submitted. `npm run -s test:brand` covers accessible variants, unique SVG IDs, stable domain and actual PNG favicon/install-icon output.

## Remaining frontend polish (not part of backend readiness)
RegisterBar smooth scroll under reduced motion; reading-specific copy ("Reader pass", "Bring any book", "Refreshments included") is still specific to this launch event; workspace toast timer cleanup.
