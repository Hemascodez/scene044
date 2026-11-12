import assert from "node:assert/strict";
import { joinedSince, seatSegments, shelfSlots } from "../lib/client/enrolled";

// Segmented seat bar: one segment per seat.
const segs = seatSegments({ booked: 14, capacity: 20 });
assert.equal(segs.length, 20);
assert.equal(segs.filter((s) => s === "filled").length, 14);
assert.equal(segs.filter((s) => s === "open").length, 6);
assert.deepEqual(seatSegments({ booked: 0, capacity: 0 }), []);
assert.equal(seatSegments({ booked: 30, capacity: 20 }).filter((s) => s === "filled").length, 20, "never more filled than seats");

// Bookshelf: a spine per reader, the next free slot is "you", the rest open.
const shelf = shelfSlots({ booked: 14, capacity: 20 });
assert.equal(shelf.length, 20);
assert.equal(shelf.filter((s) => s.kind === "taken").length, 14);
assert.equal(shelf[14].kind, "you", "the next free seat is waiting for you");
assert.equal(shelf.filter((s) => s.kind === "open").length, 5);
assert.ok(shelf.filter((s) => s.kind === "taken").every((s) => s.height >= 90 && s.height <= 120 && s.colour.length === 2));
assert.deepEqual(shelfSlots({ booked: 14, capacity: 20 }), shelf, "deterministic: same shelf every render");
assert.equal(shelfSlots({ booked: 20, capacity: 20 }).some((s) => s.kind === "you"), false, "no seat for you when full");
assert.deepEqual(shelfSlots({ booked: 0, capacity: 0 }), []);

// "+1 just joined" only when the real count went up.
assert.equal(joinedSince(14, 15), 1);
assert.equal(joinedSince(14, 17), 3);
assert.equal(joinedSince(14, 14), 0);
assert.equal(joinedSince(14, 13), 0, "a cancellation is not a join");
assert.equal(joinedSince(null, 15), 0, "first reading is not a join");

console.log("PASS seat bar, bookshelf and joins");
