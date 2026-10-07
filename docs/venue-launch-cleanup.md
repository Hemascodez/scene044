# Local-first venue launch cleanup

This change has not been applied to the live database or deployed.

## Behaviour

- Time Cafe is the only public venue and the only host-signup selection. Choosing Host does not grant curator/host dashboard access.
- An organiser booking a ₹2,000/hour space for three hours sees and pays ₹6,000. The host breakdown remains ₹6,000 minus ₹600 SCENE commission = ₹5,400 expected venue share. This is accounting, not automatic Razorpay Route transfer; Route must be separately onboarded/configured.
- A curator can explicitly prepare a selected unpaid request as a ₹10/five-minute trial. No customer-wide testing discount or automatic payment is enabled.
- Prototype organiser portraits are removed; account photos use private authenticated storage. Fixed host-profile statistics/review badges and sample host reviews are not presented as genuine data. Request success copy does not claim an email was sent.
- Removed sample landing testimonials, fictitious review counts and the anonymous five-star quote. The detail screen reads published reviews and location/rating fields from the catalog, with an honest empty state. Trial/archived booking reviews remain stored but are not public testimonials. Venue-specific equipment/inclusion copy still needs owner verification; this cleanup is not a complete audit of all prototype claims.
- Archived bookings disappear from organiser/host active lists and earnings. Curator can select **Show archived history**, inspect orders/payment evidence, and restore a booking. Old QR/approval/payment/order mutations are rejected while archived.

## Owner-approved pre-launch snapshot

The private local file `db/prelaunch-booking-snapshot.json` identifies exactly nine Time Cafe records observed on 7 October at 12:16 IST. It is gitignored and must not be published; keep a secure local copy for the approved archive operation. It includes a completed, paid ₹10 trial. That captured payment and all orders/reviews are preserved. Later bookings are never selected. This is archival, not a cancellation/refund. Regression tests use independent synthetic identifiers and do not need this private file.

## Rollout after local review

Local SQL regression testing uses ephemeral PGlite, never `DATABASE_URL`. Install `@electric-sql/pglite` into a temporary folder (not this repo), then run `node --import tsx scripts/test-venue-launch.ts --pglite=/absolute/path/to/node_modules/@electric-sql/pglite`. It exercises the real migrations and SQL helpers, stubs every Razorpay request, and closes the disposable database afterward. No production data is copied into it.

Verification on 7 October: lint, webpack production build, auth/photo/payment regressions and the local PostgreSQL launch regression passed. Browser checks at 390×844 passed on `/venues`, `/venues/time-cafe`, `/venues/search`, `/venues/partner` and unauthenticated `/bookings` (390px scroll/client width). The form showed ₹6,000 and no service-fee row; Host signup showed only Time Cafe. Preview used an isolated local PostgreSQL-compatible socket with payments/WhatsApp disabled. No authenticated browser checkout, real gateway charge, production archive or host-camera test was performed. Existing host access remains curator-guarded; this cleanup does not make self-selected Host profiles trusted venue owners.

1. Verify local lint, build and regression tests. Check ₹6,000 on the venue form and organiser checkout, and ₹600 commission only on the host view.
2. Apply `2026-10-07-venue-profile-photos.sql` and `2026-10-07-venue-booking-archive.sql` before deploying code that reads these columns/tables.
3. Run `node --env-file=<verified target env> --import tsx scripts/archive-prelaunch-bookings.ts` for a dry run. Use the same command with `--apply` only during the approved rollout. It locks exact IDs, validates codes/venue/cutoff and refuses unresolved payment orders. A different database or later-created record fails closed.
4. Deploy the reviewed change; verify the active lists and retained curator archive. Do not run a seed with `--force`, blanket-delete records, reset customer profiles, send messages or initiate charges.
5. If an earlier unpaid Razorpay order was generated under the former extra-fee price, checkout blocks rather than reusing/capturing the higher amount. Curator must reconcile that order before payment. Existing captured-payment history is not rewritten.
