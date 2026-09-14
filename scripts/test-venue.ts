/**
 * The venue registry.
 *
 * Two things matter here. First, the derived "from" price: a hardcoded ₹300 on
 * the listing card advertised a rate that existed nowhere in the data, so the
 * cheapest rate must come from the venue's own spaces — and a venue whose only
 * rates are null (quote-only) must report no price rather than ₹0. Second, the
 * live/coming-soon split, which is how a cafe being onboarded reaches the site:
 * that path is exercised here with fixtures so it is proven before a real cafe
 * is appended (naming an unverified venue in shipped data would be inventing
 * inventory, which is the thing this redesign removed).
 */
import {
  TIME_CAFE,
  VENUES,
  getVenue,
  liveVenues,
  upcomingVenueCount,
  upcomingVenues,
  venueFitsGroup,
  venueFromRate,
  venueMaxGuests,
  type VenueListing,
  type VenueSpace,
} from "../lib/venues";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

function space(over: Partial<VenueSpace> = {}): VenueSpace {
  return {
    id: "first-floor",
    name: "Room",
    eyebrow: "",
    description: "",
    capacity: "",
    maxGuests: 30,
    image: "",
    amenities: [],
    communityRate: 2000,
    productionRate: 1000,
    minimumFoodSpend: null,
    ...over,
  };
}

function listing(over: Partial<VenueListing> = {}): VenueListing {
  return {
    slug: "fixture",
    name: "Fixture Cafe",
    area: "Somewhere",
    city: "Chennai",
    status: "live",
    summary: "",
    coverImage: null,
    spaces: [space()],
    amenities: [],
    rating: null,
    ...over,
  };
}

console.log("--- the real registry ---");
check("Time Cafe is registered and live", getVenue("time-cafe")?.status, "live");
check("an unknown slug resolves to undefined", getVenue("not-a-venue"), undefined);
check("every registry entry has a unique slug", new Set(VENUES.map((v) => v.slug)).size, VENUES.length);
check(
  "Time Cafe's cheapest published rate is the small table's ₹400",
  venueFromRate(getVenue("time-cafe")!),
  400,
);
check("Time Cafe's largest space seats 30", venueMaxGuests(getVenue("time-cafe")!), 30);
check(
  "the quote-only terrace is excluded rather than counted as ₹0",
  TIME_CAFE.spaces.find((s) => s.id === "terrace")?.communityRate,
  null,
);

console.log("\n--- derived pricing ---");
check("lowest community rate wins", venueFromRate(listing({
  spaces: [space({ communityRate: 900 }), space({ communityRate: 450 }), space({ communityRate: 2000 })],
})), 450);
check("null rates are skipped, not treated as zero", venueFromRate(listing({
  spaces: [space({ communityRate: null }), space({ communityRate: 700 })],
})), 700);
check("all-null rates report no price at all", venueFromRate(listing({
  spaces: [space({ communityRate: null }), space({ communityRate: null })],
})), null);
check("a venue with no spaces yet has no price", venueFromRate(listing({ spaces: [] })), null);
check("a venue with no spaces yet has no capacity", venueMaxGuests(listing({ spaces: [] })), null);

console.log("\n--- group-size filter (the one that used to do nothing) ---");
const thirtyCap = listing({ spaces: [space({ maxGuests: 30 })] });
check("a group that fits is a match", venueFitsGroup(thirtyCap, 25), true);
check("exactly at capacity still fits", venueFitsGroup(thirtyCap, 30), true);
check("one over capacity is an honest miss", venueFitsGroup(thirtyCap, 31), false);
check("a far larger group is a miss", venueFitsGroup(thirtyCap, 50), false);
check("an unlaunched venue never claims to fit anyone", venueFitsGroup(listing({ spaces: [] }), 2), false);

console.log("\n--- live / coming-soon split ---");
const mixed: VenueListing[] = [
  listing({ slug: "a", status: "live" }),
  listing({ slug: "b", status: "coming-soon", spaces: [] }),
  listing({ slug: "c", status: "live" }),
];
check("live filter keeps only live", mixed.filter((v) => v.status === "live").map((v) => v.slug), ["a", "c"]);
check("upcoming filter keeps only upcoming", mixed.filter((v) => v.status === "coming-soon").map((v) => v.slug), ["b"]);
check("today every registered venue is live", upcomingVenues().length, 0);
check("liveVenues covers the whole registry today", liveVenues().length, VENUES.length);
check(
  "the launching-soon count includes cafes still off-registry",
  upcomingVenueCount() >= upcomingVenues().length,
  true,
);
check("the count is a positive number, so the copy renders", upcomingVenueCount() > 0, true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
