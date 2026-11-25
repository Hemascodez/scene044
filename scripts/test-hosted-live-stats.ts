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
  // This assertion tests shared counts, not whether the November edition ended.
  // Keep its clock-independent open state separate from the archived real date.
  startAt: "2999-01-01T05:30:00.000Z",
  endAt: "2999-01-01T07:30:00.000Z",
  hosted: { ...seed, capacity: 20, registeredCount: 3 },
};
const counterProps = {
  event,
  api: "mock" as const,
  children: React.createElement(
    React.Fragment,
    null,
    React.createElement(HostedSeatBadge, { event }),
    React.createElement(SharedCounter),
  ),
};
const markup = renderToStaticMarkup(React.createElement(HostedSeatStatsProvider, counterProps));
assert.ok(
  markup.includes("17 spots left") && markup.includes("3 enrolled"),
  "SSR badge and shared stats start from the same actual server count",
);
const endedEvent = { ...event, endAt: "2000-01-01T07:30:00.000Z" };
const endedCounterProps = {
  event: endedEvent,
  api: "mock" as const,
  children: React.createElement(HostedSeatBadge, { event: endedEvent }),
};
const endedMarkup = renderToStaticMarkup(React.createElement(HostedSeatStatsProvider, endedCounterProps));
assert.ok(endedMarkup.includes("This event has ended"), "archived editions must not advertise available seats");
console.log(
  "PASS shared registration-derived counts, failure retention, sold-out/reopen safety, owned-payment isolation and responsive original posters",
);
