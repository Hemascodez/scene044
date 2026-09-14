/**
 * Suitability scoring: "will this venue work for my event brief."
 *
 * The core rule under test is the honesty one — a requirement nobody
 * confirmed must read as unconfirmed, never as absent, because the data has
 * no way to prove a negative. Everything else (bands, aggregation across a
 * venue's spaces) follows from that.
 */
import { EVENT_PROFILES, scoreVenueForProfile } from "../lib/venueScore";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

console.log("--- every profile resolves to a real requirement set ---");
for (const profile of EVENT_PROFILES) {
  check(`${profile.key} has at least one must-have`, profile.must.length > 0, true);
}

console.log("\n--- band thresholds ---");
const fullyEquipped = {
  amenities: ["Strong wifi", "Projector", "Power access", "Whiteboard", "Breakout space"],
  spaces: [],
};
check(
  "every must-have confirmed is a good fit",
  scoreVenueForProfile(fullyEquipped, "workshop")?.band,
  "good-fit",
);

const partiallyEquipped = { amenities: ["Projector"], spaces: [] };
check(
  "some but not all must-haves is workable",
  scoreVenueForProfile(partiallyEquipped, "workshop")?.band,
  "workable",
);

const blankVenue = { amenities: [], spaces: [] };
check(
  "nothing confirmed reads as not-enough-confirmed, never as unsuited",
  scoreVenueForProfile(blankVenue, "workshop")?.band,
  "not-enough-confirmed",
);

console.log("\n--- unconfirmed is never asserted as absent ---");
const wifiOnly = scoreVenueForProfile({ amenities: ["Strong wifi"], spaces: [] }, "tech-meetup");
const projectorReq = wifiOnly?.must.find((r) => r.key === "projector");
check("an unmentioned requirement is 'unconfirmed'", projectorReq?.state, "unconfirmed");
check("a mentioned requirement is 'confirmed'", wifiOnly?.must.find((r) => r.key === "wifi")?.state, "confirmed");

console.log("\n--- amenities are read from every space, not just the venue's own list ---");
const onlyOnOneSpace = scoreVenueForProfile(
  { amenities: [], spaces: [{ amenities: ["Soundproofing", "Quiet corner"] }, { amenities: [] }] },
  "podcast",
);
check(
  "a requirement confirmed on any one space counts for the whole venue",
  onlyOnOneSpace?.must.find((r) => r.key === "soundproofing")?.state,
  "confirmed",
);

console.log("\n--- curator phrasing variance still matches ---");
check(
  "'Fast WiFi in every corner' still confirms wifi",
  scoreVenueForProfile({ amenities: ["Fast WiFi in every corner"], spaces: [] }, "tech-meetup")
    ?.must.find((r) => r.key === "wifi")?.state,
  "confirmed",
);

check("an unknown profile key returns null", scoreVenueForProfile(blankVenue, "not-a-real-profile"), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
