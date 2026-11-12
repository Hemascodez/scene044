import assert from "node:assert/strict";
import { resolveSwipe } from "../lib/client/swipe";
import { seatProgress } from "../lib/hostedEvents";
import { CHAPTER_LOUNGE_FIXTURE } from "../lib/hostedEvents";

// Swipe-to-pay: past 85% of the track completes; a tap (no real drag) also
// completes, so nobody has to drag (WCAG 2.5.7); anything else springs back.
assert.equal(resolveSwipe({ dx: 344, max: 404 }), "complete", "85% of the way");
assert.equal(resolveSwipe({ dx: 404, max: 404 }), "complete");
assert.equal(resolveSwipe({ dx: 300, max: 404 }), "reset", "not far enough");
assert.equal(resolveSwipe({ dx: 3, max: 404 }), "complete", "a tap counts");
assert.equal(resolveSwipe({ dx: 0, max: 404 }), "complete", "a tap counts");
assert.equal(resolveSwipe({ dx: 40, max: 404 }), "reset", "a short drag is not a tap");

// Seats: what the progress bar shows.
assert.deepEqual(seatProgress(CHAPTER_LOUNGE_FIXTURE.hosted), { booked: 14, capacity: 20, left: 6, percent: 70 });
assert.deepEqual(seatProgress({ ...CHAPTER_LOUNGE_FIXTURE.hosted, registeredCount: 25 }), { booked: 20, capacity: 20, left: 0, percent: 100 });
assert.deepEqual(seatProgress({ ...CHAPTER_LOUNGE_FIXTURE.hosted, capacity: 0, registeredCount: 0 }), { booked: 0, capacity: 0, left: 0, percent: 0 });

console.log("PASS swipe and seat progress");
