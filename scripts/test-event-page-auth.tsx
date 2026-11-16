import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { EventAccountNav } from "../components/scene/EventAccountNav";
import { SceneHeader, SceneHeaderStatic } from "../components/scene/SceneHeader";
import { SceneHero, SceneFooter } from "../components/scene/SceneHero";
import type { Profile } from "../components/venues/figma/AuthModal";

function header(profile: Profile | null, ready = true) {
  return load(
    renderToStaticMarkup(
      <SceneHeaderStatic
        accountControls={
          <EventAccountNav
            profile={profile}
            ready={ready}
            onSignIn={() => {}}
          />
        }
      />,
    ),
  );
}
const signedOut = header(null);
assert.deepEqual(
  signedOut("button")
    .map((_, el) => signedOut(el).text())
    .get(),
  ["Log in", "Sign up"],
);
assert.equal(signedOut('button[aria-haspopup="dialog"]').length, 2);
assert.equal(signedOut("button[disabled]").length, 0);
assert.equal(
  header(null, false)("button[disabled]").length,
  2,
  "wait for the authoritative shared session",
);
signedOut("button").each((_, el) => {
  assert.match(signedOut(el).attr("class")!, /min-h-11/);
  assert.match(signedOut(el).attr("class")!, /focus-visible:outline/);
});
const profile: Profile = {
  name: "Test reader",
  phone: "9876543210",
  role: "Organiser",
};
const signedIn = header(profile);
assert.equal(signedIn("button").length, 0);
assert.equal(signedIn('a[href="/bookings"]').text(), "My bookings");
assert.equal(
  header({ ...profile, role: "Host" })('a[href="/host"]').text(),
  "Host dashboard",
);
const eventHost = header({ ...profile, role: "Host", hostEventId: 164 });
assert.equal(eventHost('a[href="/host/events"]').text(), "Host dashboard");
assert.doesNotMatch(eventHost('a[href="/host/events"]').attr('class')!, /\bhidden\b/, "event dashboard remains available on mobile");
const discovery = load(renderToStaticMarkup(<SceneHeader view="discover" savedCount={2} onDiscover={() => {}} onSaved={() => {}} onSearch={() => {}} accountControls={<EventAccountNav profile={null} ready onSignIn={() => {}} />} />));
assert.equal(discovery('button').filter((_, el) => discovery(el).text() === 'Log in').length, 1);
assert.equal(discovery('button').filter((_, el) => discovery(el).text() === 'Sign up').length, 1);
assert.equal(discovery('nav[aria-label="Event discovery"]').length, 1);
assert.match(discovery('nav').attr('class')!, /order-3.*w-full/, "discovery links get a separate mobile row instead of squeezing out account actions");
assert.equal(discovery('button[aria-current="page"]').text(), 'Discover');
assert.match(discovery('button').filter((_, el) => discovery(el).text().includes('Saved')).text(), /2/);
assert.doesNotMatch(renderToStaticMarkup(<SceneHero onExplore={() => {}} />), /No account needed|Save locally/i);
assert.equal(load(renderToStaticMarkup(<SceneFooter />))('a[href="/host/login?next=%2Fhost%2Fevents"]').text(), 'Organiser sign in');
assert.equal(
  load(renderToStaticMarkup(<SceneHeaderStatic />))("button").length,
  0,
  "other static pages keep their existing header",
);
const page = readFileSync("app/events/[slug]/page.tsx", "utf8");
assert.equal(
  (page.match(/<EventPageAuth>/g) ?? []).length,
  2,
  "hosted and external event pages both expose account controls",
);
assert.ok(
  !page.includes("<VenueAppProvider>"),
  "no nested session provider separates the header from registration",
);
const bridge = readFileSync("components/scene/EventPageAuth.tsx", "utf8");
assert.match(bridge, /onSignIn=\{openAuth\}/);
assert.match(bridge, /authClassName="venue-surface"/);
assert.match(bridge, /export function EventAuthProvider/);
const app = readFileSync('components/scene/SceneApp.tsx', 'utf8');
assert.match(app, /<EventAuthProvider>/);
assert.match(app, /accountControls=\{<EventAccountControls \/>\}/);
for (const route of ['app/category/[key]/page.tsx', 'components/scene/EventCollectionView.tsx']) {
  const content = readFileSync(route, 'utf8');
  assert.match(content, /<EventPageAuth>/, `${route}: discovery landing pages expose the shared sign-in header`);
  assert.doesNotMatch(content, /<SceneHeaderStatic/);
}
const attendeeForm = readFileSync('components/scene/hosted/AttendeeForm.tsx', 'utf8');
assert.match(attendeeForm, /href="\/host\/login\?next=%2Fhost%2Fevents"/);
assert.doesNotMatch(attendeeForm, /SELECT CATEGORY|>Host<|>Organiser</, 'attendees still never choose a host role');
console.log(
  "PASS homepage/category/weekly/detail account access, shared session, role-free attendee form, organiser entry, scoped mobile host dashboard, saved-navigation preservation and removed hero line; no OTP or payments sent",
);
