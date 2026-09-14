/**
 * Promoted-event ordering.
 *
 * The one thing that must hold: a promoted event outranks the date entirely,
 * but the personal saved-events list is untouched by it (that view reflects
 * the visitor's own choices, not a curator's editorial pin) — the redesign
 * kept `bySoonest` unchanged and added a separate `byPromotedThenSoonest` for
 * exactly that reason.
 */
import { bySoonest, byPromotedThenSoonest } from "../lib/client/sceneEvent";
import type { PublicEvent } from "../lib/events";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

function evt(id: number, startAt: string | null, isPromoted = false): PublicEvent {
  return {
    id, title: `Event ${id}`, summary: null, gist: null, highlights: [], tags: [], registrationNote: null,
    category: "ai", startAt, endAt: null, isOnline: false, venueName: null, city: "Chennai",
    organizerName: null, posterImageUrl: null, priceType: null, priceNote: null,
    primarySourceDomain: "example.com", otherSourceDomains: [], status: "live",
    discoveredAt: "2026-09-01T00:00:00.000Z", lastVerifiedAt: null, isPromoted,
  } as unknown as PublicEvent;
}

console.log("--- byPromotedThenSoonest ---");
const later = evt(1, "2026-10-01T00:00:00Z");
const sooner = evt(2, "2026-09-20T00:00:00Z");
const promotedButLater = evt(3, "2026-12-01T00:00:00Z", true);

check(
  "a promoted event later in the year still sorts first",
  [later, sooner, promotedButLater].sort(byPromotedThenSoonest).map((e) => e.id),
  [3, 2, 1],
);
check(
  "two promoted events still sort soonest-first between themselves",
  [evt(1, "2026-11-01T00:00:00Z", true), evt(2, "2026-09-01T00:00:00Z", true)]
    .sort(byPromotedThenSoonest).map((e) => e.id),
  [2, 1],
);
check(
  "no promoted events falls back to plain date order",
  [later, sooner].sort(byPromotedThenSoonest).map((e) => e.id),
  [2, 1],
);

console.log("\n--- bySoonest is untouched (the saved-events list ignores promotion) ---");
check(
  "a promoted event does NOT jump the queue under plain bySoonest",
  [later, promotedButLater, sooner].sort(bySoonest).map((e) => e.id),
  [2, 1, 3],
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
