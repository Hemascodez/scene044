# Live venue trial and host operations

Only Time Cafe is publicly listed/bookable. Other catalog rows are hidden, not deleted, so historic bookings remain visible to the curator.

## One real ₹10 trial

1. Sign in with WhatsApp OTP and submit a normal Time Cafe request.
2. In `/admin/curator/venues` → **All bookings**, find the intended trial booking and select **Prepare ₹10 / 5-minute trial** before starting any payment. This deliberately flags just that request. Then approve it.
3. In `/bookings`, use **Pay & confirm**. The server, not browser input, creates a real INR 1,000-paise order. Complete Razorpay checkout yourself. An existing unpaid order is reused, and retrying the payment button recovers an earlier captured payment if its browser callback was lost.
4. Show the organiser's QR. In `/host` → **Check-in**, explicitly start the camera and scan it (HTTPS and camera permission required). Alternatively enter the SCN booking code. Only confirmed bookings can start a session.
5. Check-in stores `checked_in_at` and `ends_at` in Postgres. The trial is five minutes; ordinary bookings retain their purchased duration. Reloading/re-scanning cannot restart the timer. The host explicitly finishes the event; the timer never silently ends an event while guests are present.
6. Curator's **All bookings** records request, captured payment, check-in, completion/cancellation and food orders. It pages through the entire history; it is not limited to active bookings.

## Host menu and food tab

`/host` → **Profile** → **Time Cafe menu** accepts menu photos (JPEG/PNG/WebP, maximum 5 MB) or manual entry. OpenAI extracts editable item/price drafts. Missing/unclear prices are blank, never guessed. Review and save explicitly. Multiple photos append drafts rather than silently replacing a menu. Source photos are transient and are not stored in the host profile; the reviewed menu items are stored in Neon.

Available items can be added with quantities to each checked-in organiser's session. The server copies the item name and paise unit price into the booking order, preserving history even after menu changes. Food/drink tabs are recorded separately, not automatically charged through Razorpay. Prices and quantities are computed server-side, and repeated submissions with the same request key are idempotent.

Host/admin endpoints still require curator credentials. This does **not** grant all logged-in users host access, or introduce per-venue host roles. Add scoped host membership before onboarding independently administered venues.

## Rollout and verification

Apply `db/migrations/2026-10-06-venue-operations.sql` to the application's Neon database before deploying. It is additive/idempotent and hides non-Time-Cafe venue rows without removing booking history. Equivalent DDL is included in the setup schema files.

Existing `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `CURATOR_PASSWORD`, `DATABASE_URL`, and `OPENAI_API_KEY` are used. Optional `MENU_EXTRACT_MODEL` overrides the existing extraction model. No digest schedule or notification settings are changed.

```sh
npm run lint
npm run build
node --env-file=.env.local --import tsx scripts/test-venue-operations.ts
node --env-file=.env.local --import tsx scripts/test-menu-extraction.ts
```

The operations test uses an outer rollback transaction: fixture rows never persist, no Razorpay requests are made, and no WhatsApp messages are sent. The extraction test sends only a synthetic menu to OpenAI and does not save it. Neither replaces the physical-camera/live-payment trial.
