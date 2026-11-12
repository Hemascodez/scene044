import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAPTER_LOUNGE_FIXTURE, seatSummary } from "../lib/hostedEvents";
import { mergeHostedSeatStats } from "../lib/client/hostedSeatStats";
import { flowReducer, initialFlow } from "../lib/client/registrationFlow";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HostedSeatBadge,
  HostedSeatStatsProvider,
  useHostedSeatStats,
} from "../components/scene/hosted/HostedSeatStats";

const seed = CHAPTER_LOUNGE_FIXTURE.hosted;
const first = mergeHostedSeatStats(seed, { registeredCount: 1, capacity: 20 })!;
assert.equal(first.registeredCount, 1);
assert.equal(
  seed.registeredCount,
  0,
  "never mutate the event fixture or invent registrations",
);
assert.equal(seatSummary(first, null, new Date("2026-11-12")).spotsLeft, 19);
assert.equal(mergeHostedSeatStats(first, null), null);
assert.equal(
  mergeHostedSeatStats(first, { registeredCount: -1, capacity: 20 }),
  null,
);
assert.equal(
  mergeHostedSeatStats(first, { registeredCount: NaN, capacity: 20 }),
  null,
);
assert.equal(
  mergeHostedSeatStats(first, { registeredCount: 1, capacity: 0 }),
  null,
);
const full = mergeHostedSeatStats(first, {
  registeredCount: 20,
  capacity: 20,
})!;
assert.equal(seatSummary(full, null).state, "sold_out");
assert.equal(
  seatSummary(
    mergeHostedSeatStats(full, { registeredCount: 19, capacity: 20 })!,
    null,
  ).spotsLeft,
  1,
  "cancellations release a displayed spot",
);
const idle = initialFlow({ state: "open" }, null);
const sold = flowReducer(idle, { type: "seat_changed", state: "sold_out" });
assert.equal(sold.step, "sold_out");
assert.equal(
  flowReducer(sold, { type: "seat_changed", state: "open" }).step,
  "idle",
);
for (const step of ["details", "paying", "confirming", "confirmed"] as const) {
  const state = { ...idle, step };
  assert.equal(
    flowReducer(state, { type: "seat_changed", state: "sold_out" }),
    state,
    "live counters never interrupt owned holds or tickets",
  );
}
const page = readFileSync(
  "components/scene/hosted/HostedEventView.tsx",
  "utf8",
);
assert.match(page, /HostedSeatStatsProvider/);
assert.match(page, /HostedSeatBadge/);
assert.match(page, /poster-landscape\.png/);
assert.match(page, /min-width: 640px/);
assert.match(page, /width: 2880, height: 1280/);
assert.match(page, /width: 1120, height: 1400/);
assert.ok(readFileSync('next.config.ts','utf8').includes("pathname: '/events/chapter-lounge/**'"), 'optimized art-direction assets are explicitly allowed');
const reader = readFileSync(
  "components/scene/hosted/ReadersEnrolled.tsx",
  "utf8",
);
const registration = readFileSync(
  "components/scene/hosted/HostedRegistration.tsx",
  "utf8",
);
assert.match(reader, /useHostedSeatStats/);
assert.match(registration, /useHostedSeatStats/);
assert.match(registration, /await api\.verify[\s\S]*void refresh\(\)/);
function SharedCounter() {
  return React.createElement(
    "span",
    null,
    `${useHostedSeatStats().hosted.registeredCount} enrolled`,
  );
}
const event = {
  ...CHAPTER_LOUNGE_FIXTURE,
  hosted: { ...seed, registeredCount: 3 },
};
const markup = renderToStaticMarkup(
  React.createElement(HostedSeatStatsProvider, {
    event,
    api: "mock",
    children: React.createElement(
      React.Fragment,
      null,
      React.createElement(HostedSeatBadge, { event }),
      React.createElement(SharedCounter),
    ),
  }),
);
assert.ok(
  markup.includes("17 spots left") && markup.includes("3 enrolled"),
  "SSR badge and shared stats start from the same actual server count",
);
console.log(
  "PASS shared registration-derived counts, failure retention, sold-out/reopen safety, owned-payment isolation and responsive original posters",
);
