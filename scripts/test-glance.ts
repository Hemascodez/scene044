/**
 * The "At a glance" block that now opens the event page.
 *
 * Two things are worth locking down. The facts half is derived from our own
 * columns, so it must never invent one — a price we were never told has to stay
 * absent rather than render as "Free". The gist half is model-written, so it
 * goes through the same honesty checks as the story, and those checks are
 * imported here rather than re-implemented so the test can't drift from them.
 */
import { glanceFactsFor } from "../lib/client/sceneEvent";
import { cleanGist, gistViolation } from "../lib/summarize";
import type { PublicEvent } from "../lib/events";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

type GlanceInput = PublicEvent & { venueAddress?: string | null };

function evt(over: Partial<GlanceInput> = {}): GlanceInput {
  return {
    id: 1,
    title: "Chennai AI Meetup",
    summary: "An evening of talks.",
    highlights: [],
    registrationNote: null,
    category: "ai",
    startAt: "2026-09-19T04:00:00.000Z",
    endAt: null,
    isOnline: false,
    venueName: "IITM Research Park",
    city: "Chennai",
    organizerName: "AI Chennai",
    posterImageUrl: null,
    priceType: null,
    priceNote: null,
    primarySourceDomain: "meetup.com",
    otherSourceDomains: [],
    status: "live",
    discoveredAt: "2026-09-14T04:00:00.000Z",
    lastVerifiedAt: null,
    ...over,
  } as GlanceInput;
}

const labels = (e: GlanceInput) => glanceFactsFor(e).map((f) => f.label);
const valueOf = (e: GlanceInput, label: string) =>
  glanceFactsFor(e).find((f) => f.label === label)?.value ?? null;

console.log("--- facts are derived, never invented ---");
check("unstated price is omitted entirely, not shown as Free", labels(evt()), ["When", "Where"]);
check("free price surfaces", valueOf(evt({ priceType: "free" }), "Price"), "Free");
check("paid price uses the source's own note", valueOf(evt({ priceType: "paid", priceNote: "₹499" }), "Price"), "₹499");
check(
  "paid with no published amount still says Paid rather than guessing",
  valueOf(evt({ priceType: "paid" }), "Price"),
  "Paid",
);
check("online events report Online, not a venue", valueOf(evt({ isOnline: true }), "Where"), "Online");
check(
  "in-person falls back to city when the venue is unannounced",
  valueOf(evt({ venueName: null }), "Where"),
  "Chennai",
);
check("undated event says so instead of rendering an epoch date", valueOf(evt({ startAt: null }), "When"), "Not announced");
check(
  "audience appears only when the copy evidences it",
  labels(evt({ summary: "A beginner friendly session for students." })),
  ["When", "Where", "For"],
);

console.log("\n--- facts absorbed from the removed Event details card ---");
check(
  "end time joins the When fact when published",
  valueOf(evt({ endAt: "2026-09-19T06:30:00.000Z" }), "When"),
  "Sat, 19 Sep · 9:30 am – 12:00 pm",
);
check(
  "no end time leaves When with just the start",
  valueOf(evt({ endAt: null }), "When"),
  "Sat, 19 Sep · 9:30 am",
);
const withAddress = glanceFactsFor(
  evt({ venueAddress: "1 Krishna St, Nungambakkam, Chennai 600034" }),
).find((f) => f.label === "Where");
check(
  "street address rides along as a hint under the venue",
  withAddress?.hint,
  "1 Krishna St, Nungambakkam, Chennai 600034",
);
check("venue name stays the primary value", withAddress?.value, "IITM Research Park");
check(
  "online events carry no address hint",
  glanceFactsFor(evt({ isOnline: true, venueAddress: "somewhere" }))
    .find((f) => f.label === "Where")?.hint,
  undefined,
);

console.log("\n--- gist length cap ---");
check("short gist passes through unchanged", cleanGist("A workshop on RAG pipelines."), "A workshop on RAG pipelines.");
check("non-string is null", cleanGist(42), null);
check("empty string is null", cleanGist("   "), null);
const long = cleanGist("x".repeat(400));
check("over-length gist is capped at 140", long?.length, 140);
check("capped gist is marked as truncated", long?.endsWith("…"), true);

console.log("\n--- gist honesty checks (same rules as the story) ---");
const source = "A hands-on workshop with a Q&A. Free entry.";
check("clean grounded gist passes", gistViolation("A hands-on workshop, followed by a Q&A.", source), null);
check(
  "banned filler is rejected",
  gistViolation("Join us for an evening of talks.", source),
  'gist uses banned filler "join us for"',
);
check(
  "a claim the source never made is rejected",
  gistViolation("A beginner-friendly intro session.", "A talk for senior engineers."),
  'gist claims "beginner-friendly" but the description never says so',
);
check("emoji is rejected", gistViolation("A workshop on RAG 🚀", source), "gist contains an emoji");
check(
  "a rhetorical hook is rejected",
  gistViolation("Ever wondered how RAG works?", source),
  "gist is phrased as a hook/question",
);
check(
  "excluded address term is rejected",
  gistViolation("A workshop, da, on pipelines.", source),
  'gist uses excluded address term "da"',
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
