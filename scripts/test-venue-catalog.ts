/**
 * The database-backed venue catalog, partner leads, and earnings.
 *
 * Three things are worth defending. A venue the curator is still filling in
 * must not leak onto the public site. A partner lead must survive (the form
 * used to show "you're on the list" and discard the submission). And earnings
 * must only count money that actually changed hands — reporting requested or
 * approved bookings as revenue would invent income.
 *
 * Runs against the local dev database and cleans up after itself.
 */
import { pool, query } from "../lib/db";
import {
  SCENE_FEE_RATE,
  countNewPartnerRequests,
  createPartnerRequest,
  createVenue,
  deleteVenue,
  deleteVenueSpace,
  getCatalogVenue,
  listAllVenues,
  listPartnerRequests,
  listPublicVenues,
  setPartnerRequestStatus,
  updateVenue,
  upsertVenueSpace,
  venueEarnings,
} from "../lib/venueCatalog";
import { createVenueBooking, setBookingStatus, addBookingOrder, checkInBooking } from "../lib/venueBookings";
import { venueFromRate, venueMaxGuests } from "../lib/venues";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

const SLUG = "catalog-test-cafe";
const SLUG2 = "catalog-test-draft";
const EARN_SLUG = "earnings-test.invalid";

async function cleanup() {
  await deleteVenue(SLUG);
  await deleteVenue(SLUG2);
  await query("DELETE FROM venue_bookings WHERE venue_slug = $1", [EARN_SLUG]);
  await query("DELETE FROM venue_partner_requests WHERE venue_name LIKE 'CatalogTest%'", []);
}

async function main() {
  await cleanup();

  console.log("--- a new venue is a private draft, not a live listing ---");
  const created = await createVenue({ slug: SLUG, name: "Catalog Test Cafe", area: "Testnagar" });
  check("a venue created by the curator starts hidden", created.status, "hidden");
  const publicSlugs = (await listPublicVenues()).map((v) => v.slug);
  check("a hidden draft is absent from the public site", publicSlugs.includes(SLUG), false);
  check("but the curator can see it", (await listAllVenues()).some((v) => v.slug === SLUG), true);

  console.log("\n--- the curator can edit every field of the public page ---");
  const edited = await updateVenue(SLUG, {
    name: "Catalog Test Cafe (renamed)",
    area: "Nungambakkam",
    address: "1 Test Street, Chennai 600001",
    summary: "A test venue used by scripts/test-venue-catalog.ts.",
    phone: "+91 90000 00000",
    rating: 4.6,
    ratingCount: 12,
    amenities: ["Strong wifi", "Projector"],
    policies: ["Test policy one.", "Test policy two."],
    photos: ["/venues/time-cafe/terrace.jpeg"],
    status: "live",
  });
  check("name is editable", edited?.name, "Catalog Test Cafe (renamed)");
  check("address is editable", edited?.address, "1 Test Street, Chennai 600001");
  check("amenities are editable", edited?.amenities, ["Strong wifi", "Projector"]);
  check("policies are editable", edited?.policies?.length, 2);
  check("rating survives the NUMERIC round-trip as a number", edited?.rating, 4.6);
  check("publishing makes it public", (await listPublicVenues()).some((v) => v.slug === SLUG), true);
  check("editing an unknown venue returns null, not a crash", await updateVenue("no-such-venue", { name: "x" }), null);

  console.log("\n--- spaces (rooms) are editable and upsert cleanly ---");
  const venueId = created.id;
  await upsertVenueSpace(venueId, {
    spaceKey: "main-hall", name: "Main hall", maxGuests: 40,
    communityRate: 2500, productionRate: 1200, minimumFoodSpend: 8000, sortOrder: 0,
  });
  await upsertVenueSpace(venueId, {
    spaceKey: "quiet-corner", name: "Quiet corner", maxGuests: 6,
    communityRate: 600, productionRate: null, minimumFoodSpend: null, sortOrder: 1,
  });
  let withSpaces = await getCatalogVenue(SLUG);
  check("both rooms saved", withSpaces?.spaces.length, 2);
  check("rooms come back in sort order", withSpaces?.spaces.map((s) => s.id), ["main-hall", "quiet-corner"]);

  await upsertVenueSpace(venueId, { spaceKey: "main-hall", name: "Main hall (updated)", maxGuests: 45, communityRate: 2600, sortOrder: 0 });
  withSpaces = await getCatalogVenue(SLUG);
  check("re-saving a room updates rather than duplicating it", withSpaces?.spaces.length, 2);
  check("the update took effect", withSpaces?.spaces[0]?.name, "Main hall (updated)");
  check("capacity update took effect", withSpaces?.spaces[0]?.maxGuests, 45);

  console.log("\n--- the pricing helpers work on catalog data too ---");
  check("cheapest published rate across DB rooms", venueFromRate(withSpaces!), 600);
  check("largest DB room drives capacity", venueMaxGuests(withSpaces!), 45);
  const quoteOnly = await createVenue({ slug: SLUG2, name: "Draft", area: "X" });
  await upsertVenueSpace(quoteOnly.id, { spaceKey: "terrace", name: "Terrace", maxGuests: 20, communityRate: null });
  check(
    "a quote-only venue reports no price rather than zero",
    venueFromRate((await getCatalogVenue(SLUG2))!),
    null,
  );

  const removedRoom = withSpaces!.spaces[1]!;
  check("a room can be deleted", await deleteVenueSpace(removedRoom.rowId), true);
  check("and is gone", (await getCatalogVenue(SLUG))?.spaces.length, 1);

  console.log("\n--- partner leads now survive ---");
  const lead = await createPartnerRequest({
    contactName: "Test Owner", phone: "+919888888888",
    venueName: "CatalogTest Rooftop", area: "Adyar",
    link: "https://example.com", details: "A rooftop that seats 40 with power and wifi.",
  });
  check("a submitted lead is stored, not discarded", lead.venueName, "CatalogTest Rooftop");
  check("it lands in the curator queue as new", lead.status, "new");
  check("it appears in the queue listing", (await listPartnerRequests("new")).some((r) => r.id === lead.id), true);
  check("the curator badge counts it", (await countNewPartnerRequests()) >= 1, true);
  const moved = await setPartnerRequestStatus(lead.id, "contacted", "Called, sending photos.");
  check("the curator can advance it", moved?.status, "contacted");
  check("and attach a note", moved?.curatorNote, "Called, sending photos.");
  check("it leaves the new queue once actioned", (await listPartnerRequests("new")).some((r) => r.id === lead.id), false);
  check("an unknown lead id returns null", await setPartnerRequestStatus(999999999, "listed"), null);

  console.log("\n--- earnings count only money that actually moved ---");
  const base = {
    venueSlug: EARN_SLUG, venueName: "Earnings Test", spaceId: "main", spaceName: "Main",
    eventDate: "2026-12-01", startTime: "18:00", durationHours: 2, people: 20,
    eventType: "Tech meetup", description: "Earnings fixture booking for tests.",
    organizerName: "E", organizerEmail: "e@example.com", organizerPhone: "+910000000000",
    hourlyRate: 2000, total: 4000,
  };
  const justRequested = await createVenueBooking(base);
  check("a request alone earns nothing", (await venueEarnings(EARN_SLUG)).grossValue, 0);

  await setBookingStatus(justRequested.id, "approved");
  check("an approved-but-unpaid booking still earns nothing", (await venueEarnings(EARN_SLUG)).grossValue, 0);

  await setBookingStatus(justRequested.id, "confirmed");
  const afterPayment = await venueEarnings(EARN_SLUG);
  check("a confirmed booking counts", afterPayment.grossValue, 4000);
  check("SCENE's fee is 10%", afterPayment.sceneFee, 400);
  check("the venue keeps the rest", afterPayment.venuePayout, 3600);
  check("fee rate matches what the partner page promises", SCENE_FEE_RATE, 0.1);
  check("confirmed count is right", afterPayment.confirmedCount, 1);

  const declined = await createVenueBooking({ ...base, total: 9999 });
  await setBookingStatus(declined.id, "declined");
  check("a declined booking never counts", (await venueEarnings(EARN_SLUG)).grossValue, 4000);

  await checkInBooking(justRequested.id);
  await addBookingOrder(justRequested.id, "Coffees", 500);
  const withOrders = await venueEarnings(EARN_SLUG);
  check("food revenue is tracked separately", withOrders.orderRevenue, 500);
  check("food is not part of SCENE's fee base", withOrders.sceneFee, 400);

  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => pool.end());
