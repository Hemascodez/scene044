/**
 * Server-backed venue bookings: the lifecycle, the check-in clock, orders, and
 * the review gate.
 *
 * The rules worth defending here are the ones that protect real money and real
 * trust: a double-scanned QR must not restart a customer's clock, an order must
 * attach to the event that actually placed it, and a review must be impossible
 * without a completed booking behind it (the public listing claims exactly
 * that, so it has to be true by construction).
 *
 * Runs against the local dev database and cleans up after itself.
 */
import { pool, query } from "../lib/db";
import {
  addBookingOrder,
  canTransition,
  checkInBooking,
  claimOverrunNotification,
  completeBooking,
  createVenueBooking,
  createVenueReview,
  findOverrunBookings,
  getBookingByCheckinToken,
  getBookingByCode,
  listBookingOrders,
  listVenueReviews,
  newBookingCode,
  newCheckinToken,
  orderTotalsByBooking,
  setBookingStatus,
  summariseReviews,
  type NewBookingInput,
  type VenueReview,
} from "../lib/venueBookings";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

const SLUG = "booking-test.invalid";

function input(over: Partial<NewBookingInput> = {}): NewBookingInput {
  return {
    venueSlug: SLUG,
    venueName: "Test Cafe",
    spaceId: "first-floor",
    spaceName: "First-floor event space",
    eventDate: "2026-11-20",
    startTime: "18:30",
    durationHours: 2,
    people: 20,
    eventType: "Tech meetup",
    description: "A test booking used by scripts/test-venue-bookings.ts.",
    organizerName: "Test Organizer",
    organizerEmail: "test@example.com",
    organizerPhone: "+919999999999",
    hourlyRate: 2000,
    total: 4000,
    ...over,
  };
}

async function cleanup() {
  await query("DELETE FROM venue_bookings WHERE venue_slug = $1", [SLUG]);
}

async function main() {
  await cleanup();

  console.log("--- codes and tokens ---");
  const codes = new Set(Array.from({ length: 300 }, () => newBookingCode()));
  check("300 generated codes are all distinct", codes.size, 300);
  check("code is prefixed and 6 chars of body", /^SCN-[ACDEFGHJKLMNPQRTUVWXY34679]{6}$/.test(newBookingCode()), true);
  check(
    "code alphabet excludes look-alike characters (I O S B Z 0 1 2 5 8)",
    /[IOSBZ01258]/.test(newBookingCode().slice(4)),
    false,
  );
  check("check-in token is 48 hex chars", /^[0-9a-f]{48}$/.test(newCheckinToken()), true);
  check("tokens are distinct", new Set(Array.from({ length: 100 }, newCheckinToken)).size, 100);

  console.log("\n--- lifecycle guards ---");
  check("requested can be approved", canTransition("requested", "approved"), true);
  check("approved can be confirmed", canTransition("approved", "confirmed"), true);
  check("confirmed can be checked in", canTransition("confirmed", "checked_in"), true);
  check("a completed booking is terminal", canTransition("completed", "checked_in"), false);
  check("a declined booking cannot be revived", canTransition("declined", "approved"), false);
  check("you cannot check in before confirming (skipping payment)", canTransition("approved", "checked_in"), false);

  console.log("\n--- create and look up ---");
  const booking = await createVenueBooking(input());
  check("new booking starts as requested", booking.status, "requested");
  check("new booking has a code", /^SCN-/.test(booking.code), true);
  check("lookup by code works", (await getBookingByCode(booking.code))?.id, booking.id);
  check("lookup by code is case-insensitive", (await getBookingByCode(booking.code.toLowerCase()))?.id, booking.id);
  check("lookup by QR token works", (await getBookingByCheckinToken(booking.checkinToken))?.id, booking.id);
  check("an unknown code resolves to null", await getBookingByCode("SCN-XXXXXX"), null);
  check("the code is not derivable from the token", booking.checkinToken.includes(booking.code.slice(4)), false);

  console.log("\n--- check-in starts the clock from the scan, not the booked time ---");
  check("cannot check in a merely requested booking", await checkInBooking(booking.id), null);
  await setBookingStatus(booking.id, "approved");
  await setBookingStatus(booking.id, "confirmed");
  const checkedIn = await checkInBooking(booking.id);
  check("check-in succeeds once confirmed", checkedIn?.status, "checked_in");
  const startedAt = checkedIn?.checkedInAt ? Date.parse(checkedIn.checkedInAt) : 0;
  const endsAt = checkedIn?.endsAt ? Date.parse(checkedIn.endsAt) : 0;
  check("ends_at is exactly the booked duration after the scan", Math.round((endsAt - startedAt) / 60000), 120);
  check(
    "ends_at is derived from the scan, not the 18:30 booked start",
    new Date(endsAt).toISOString().slice(0, 10) !== "2026-11-20",
    true,
  );

  const secondScan = await checkInBooking(booking.id);
  check("a second scan is a no-op, not a restarted clock", secondScan, null);

  console.log("\n--- orders: who ordered what ---");
  check("order attaches to a running event", (await addBookingOrder(booking.id, "2 filter coffees", 240))?.amount, 240);
  await addBookingOrder(booking.id, "Sandwich platter", 1800);
  const orders = await listBookingOrders(booking.id);
  check("both orders are listed", orders.map((o) => o.amount), [240, 1800]);
  const totals = await orderTotalsByBooking(SLUG);
  check("running tab sums per booking", totals.get(booking.id), 2040);

  const notArrived = await createVenueBooking(input({ organizerName: "Not Arrived" }));
  check(
    "an order cannot attach to a booking nobody checked in",
    await addBookingOrder(notArrived.id, "Mistyped code", 500),
    null,
  );

  console.log("\n--- overrun sweep ---");
  await query("UPDATE venue_bookings SET ends_at = now() - interval '5 minutes' WHERE id = $1", [booking.id]);
  const overrun = await findOverrunBookings();
  check("a booking past its finish is picked up", overrun.some((b) => b.id === booking.id), true);
  check("claiming the notification succeeds once", await claimOverrunNotification(booking.id), true);
  check("claiming twice is refused, so the owner is pinged once", await claimOverrunNotification(booking.id), false);
  check(
    "an already-notified booking drops out of the sweep",
    (await findOverrunBookings()).some((b) => b.id === booking.id),
    false,
  );

  console.log("\n--- the review gate ---");
  check(
    "a review is refused while the event is still running",
    await createVenueReview({ bookingId: booking.id, venueSlug: SLUG, rating: 5, tags: ["Wifi"], comment: "Early", photoIds: [], photoConsent: true }),
    null,
  );
  await completeBooking(booking.id);
  const review = await createVenueReview({
    bookingId: booking.id, venueSlug: SLUG, rating: 5,
    tags: ["Wifi", "Vibe"], comment: "Wifi held up for 20 people on a call.",
    photoIds: [], photoConsent: true,
  });
  check("a completed booking can be reviewed", review?.rating, 5);
  check(
    "the same booking cannot be reviewed twice",
    await createVenueReview({ bookingId: booking.id, venueSlug: SLUG, rating: 1, tags: [], comment: "Astroturf", photoIds: [], photoConsent: false }),
    null,
  );
  check(
    "a booking that was never completed cannot be reviewed at all",
    await createVenueReview({ bookingId: notArrived.id, venueSlug: SLUG, rating: 5, tags: [], comment: "Never came", photoIds: [], photoConsent: false }),
    null,
  );
  const listed = await listVenueReviews(SLUG);
  check("the review reaches the venue's list (what the host view reads)", listed.length, 1);
  check("it carries the organizer's name for the host view", listed[0]?.organizerName, "Test Organizer");

  console.log("\n--- review summary is counted, not estimated ---");
  const fixtures = [
    { rating: 5, tags: ["Wifi", "Food"] },
    { rating: 4, tags: ["Wifi"] },
    { rating: 2, tags: ["Noise", "Wifi"] },
  ] as unknown as VenueReview[];
  const summary = summariseReviews(fixtures);
  check("count is the number of reviews", summary.count, 3);
  check("average is rounded to one decimal", summary.averageRating, 3.7);
  check("most-mentioned tag leads", summary.tagCounts[0], ["Wifi", 3]);
  check("no reviews means no average, not zero", summariseReviews([]).averageRating, null);

  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => pool.end());
