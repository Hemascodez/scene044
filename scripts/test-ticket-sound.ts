import assert from "node:assert/strict";
import { PRINT_TIMING, ticketPrintSchedule } from "../lib/client/ticketSound";

// The sound is timed to the animation: one chatter burst per paper-feed step.
assert.deepEqual(PRINT_TIMING, { feedMs: 1600, feedSteps: 24, settleMs: 350 });

const schedule = ticketPrintSchedule(PRINT_TIMING);
assert.equal(schedule.bursts.length, 24);
assert.equal(schedule.bursts[0], 0);
assert.ok(Math.abs(schedule.bursts[1] - 1600 / 24) < 0.001, "evenly spaced steps");
assert.ok(schedule.bursts.every((t) => t < 1600), "every burst lands inside the feed");
assert.equal(schedule.cutAt, 1600, "the cutter fires as the feed stops");
assert.equal(schedule.dingAt, 1950, "the bell rings when the ticket settles");

console.log("PASS ticket sound schedule");
