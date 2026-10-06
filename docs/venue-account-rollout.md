# Venue accounts: rollout and boundaries

The account is keyed by a verified Indian WhatsApp number. Each successful OTP
creates a 30-day, HTTP-only, server-revocable session. New bookings record the
verified account id, and “My bookings” queries Postgres by that id across
devices. On first login, unowned older bookings with the same phone number are
claimed. The check-in QR remains a separate credential for the host's scanner.

## Production rollout order

1. Confirm Railway's `DATABASE_URL` points to the intended Neon production branch.
   Do not paste it into logs or chat.
   Keep `WHATSAPP_OTP_HASH_SECRET` stable if set; otherwise the existing
   WhatsApp app secret/access token is used as the OTP HMAC key.
2. Apply [`db/migrations/2026-10-06-venue-accounts.sql`](../db/migrations/2026-10-06-venue-accounts.sql)
   and then [`db/migrations/2026-10-06-venue-booking-drafts.sql`](../db/migrations/2026-10-06-venue-booking-drafts.sql)
   to that database. Both are additive and re-runnable.
3. Deploy the application commit. Do **not** deploy the code before the
   migration: its booking query selects the new `organizer_user_id` column.
   Any OTP sent before this version must be requested again because storage
   changes from an unkeyed hash to HMAC; codes already expire after 10 minutes.
4. On a test number, request an OTP, verify it, start a booking, and open a second
   browser. Check the unfinished form appears. Submit it, then confirm the draft
   disappears and the same booking and QR appear after signing in again. An OTP
   must not be reusable; a logged-out browser must receive 401 for booking APIs.

Do not use the broad `npm run migrate` command for this targeted rollout unless
you intend to re-apply the entire schema. No automatic WhatsApp digest send is
part of this change.

## What this does not solve yet

- Host access remains behind the shared curator login in `proxy.ts`; a venue
  account with role `Host` is not host authorization.
- Profile photos and self-reported review drafts still live in browser
  localStorage. New entries are scoped to the verified phone on that browser,
  but they do not sync between devices. Old global photo/review data migrates
  only when its saved phone matches the newly verified phone. Otherwise it is
  preserved but not shown to a different signed-in account.
- Manual venue blocks still live in browser localStorage.
- Razorpay order-to-booking binding and host payout via Razorpay Route are
  separate work. Do not treat this account rollout as a completed live-payment
  reconciliation or split-settlement implementation.
