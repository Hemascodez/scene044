import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { EventAccountNav } from "../components/scene/EventAccountNav";
import { SceneHeaderStatic } from "../components/scene/SceneHeader";
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
console.log(
  "PASS event login/signup, shared session, mobile-sized controls, signed-in bookings and unchanged non-event headers; no OTP or payments sent",
);
