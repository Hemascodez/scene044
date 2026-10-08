# Time Cafe host access

Curator → Venues → **Host access** controls the approved phone numbers. Adding
a number does not create an account/session. The person must sign in as Host,
select Time Cafe and verify their own number with the existing WhatsApp OTP.
An unapproved number sees: “Contact your Time Cafe admin to add your number to
sign in.” Organiser sign-in and booking history remain available.

## Server guarantees

- Only curator authentication can list, approve, reapprove or revoke numbers.
- Host signup checks approval before sending OTP, and checks it again inside
  the verification transaction with a shared row lock before granting a session.
- Host pages and every host API require a verified session and current approval.
  Choosing a client role, editing a profile, an old Host database role, or knowing
  a phone number is not sufficient. Hosts cannot access curator APIs.
- Booking actions, orders and QR check-in are scoped to Time Cafe. Approval
  revocation blocks subsequent requests from already-issued host sessions.
- Removal is recoverable (Approve again). It does not delete accounts, bookings,
  payment records or reviews. A reapproved number with a still-valid previously
  verified Host session can access the workspace again; expired sessions need OTP.
- Host/curator access mutations reject cross-origin browser requests.

## Deployment prerequisite

Apply the schema before starting the new application. `railway.json` specifies
`npm run migrate && npm run migrate:event-metadata && npm start`. Check that the
service's start-command override does not bypass migrations.

Additive migrations relevant to this release:

1. `db/migrations/2026-10-07-venue-booking-archive.sql`
2. `db/migrations/2026-10-07-venue-profile-photos.sql`
3. `db/migrations/2026-10-08-venue-host-access.sql`

These create columns/tables without archiving or deleting any booking. Do not
run the private booking-archive manifest as part of host-access setup. No phone
is hardcoded/seeded into the public repository. Approve the intended real host
number through the curator after migration (or an explicitly authorized setup).

## Safe verification

```sh
npm run lint -- --quiet
npm run build -- --webpack
npm run test:venue-auth
node --import tsx scripts/test-venue-host-access.ts --pglite=/absolute/path/to/@electric-sql/pglite
node --import tsx scripts/test-venue-launch.ts --pglite=/absolute/path/to/@electric-sql/pglite
```

Both PGlite tests install real SQL into an isolated in-memory database. They do
not read `.env.local`, touch Neon, send OTPs, or make real Razorpay payments.
Live OTP delivery and a captured Razorpay transaction still require a separately
authorized live trial; passing isolated tests is not proof of live delivery.

Readiness checks on 2026-10-08 initially found that the configured Neon database
lacked `archived_at` and `venue_host_access`. With the owner's authorization,
the three additive migrations above were applied. Existing account, booking
and payment-record counts were unchanged. The approved host number was added
to the database only (not committed here). The new host controls and safer
curator error states still require deployment. No personal identifiers or
production credentials belong in this document.
