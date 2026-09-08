import type { PublicEventDetail } from "../lib/events";
import { formatSceneDateLong } from "../lib/client/istTime";
import {
  actionizeEventHighlight,
  audienceTagsFor,
  eventShortIntro,
  eventSummaryBullets,
  usableEventSummary,
} from "../lib/client/sceneEvent";
import {
  absoluteUrl,
  eventIdFromSlug,
  eventPath,
  eventSeoDescription,
  eventSlug,
  eventStructuredData,
  serializeJsonLd,
  truncateSeoText,
} from "../lib/seo";
import { eventTitleMatchScore, eventTitlesLikelyMatch } from "../lib/extract";

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

const event: PublicEventDetail = {
  id: 42,
  title: "AI & Product Night: Chennai!",
  summary: "Meet builders and learn what is changing in applied AI.",
  highlights: ["Founder talks"],
  registrationNote: null,
  category: "ai",
  startAt: "2026-09-27T04:00:00.000Z",
  endAt: "2026-09-27T06:00:00.000Z",
  isOnline: false,
  venueName: "IIT Madras Research Park",
  venueAddress: "Taramani, Chennai",
  city: "Chennai",
  organizerName: "Chennai AI Community",
  posterImageUrl: "/stock/ai-1.jpg",
  priceType: "free",
  priceNote: null,
  primarySourceUrl: "https://example.com/register",
  primarySourceDomain: "example.com",
  otherSourceDomains: [],
  status: "live",
  discoveredAt: "2026-09-01T00:00:00.000Z",
  lastVerifiedAt: "2026-09-08T00:00:00.000Z",
  updatedAt: "2026-09-08T00:00:00.000Z",
};

check("slug is descriptive and id-backed", eventSlug(event), "ai-and-product-night-chennai-42");
check("event path uses canonical route", eventPath(event), "/events/ai-and-product-night-chennai-42");
check("id parses from canonical slug", eventIdFromSlug(eventSlug(event)), 42);
check("malformed slug has no id", eventIdFromSlug("ai-night"), null);
check("zero is not a valid event id", eventIdFromSlug("ai-night-0"), null);
check("absolute paths resolve against production", absoluteUrl("/events/example-1"), "https://scene044.in/events/example-1");
check("non-Latin-only title gets stable fallback", eventSlug({ id: 9, title: "சென்னை நிகழ்வு" }), "event-9");
check("search-facing date includes the year", formatSceneDateLong(event.startAt!), "Sun, 27 Sep 2026");
check(
  "audience tags require phrases in source-backed copy",
  audienceTagsFor({
    ...event,
    highlights: [],
    summary: "For students and working professionals. Beginner friendly.",
  }).map((tag) => tag.label),
  ["Beginner friendly", "Students", "Professionals"],
);
check(
  "category alone does not invent an audience",
  audienceTagsFor({ ...event, title: "AI Night", summary: "A talk about applied AI.", highlights: [] }),
  [],
);
check("scan bullets turn source highlights into actions", eventSummaryBullets(event), ["Hear directly from founders"]);
check(
  "older records do not turn descriptive prose into promised outcomes",
  eventSummaryBullets({ ...event, highlights: [], summary: "First useful point. Second useful point! Third useful point? Fourth point." }),
  [],
);
check("highlighted events get one short setup sentence", eventShortIntro(event), event.summary);
check(
  "rhetorical legacy hooks are skipped in the short overview",
  eventShortIntro({ ...event, summary: "Building AI systems and looking for sharper conversations? Hear practitioners discuss applied AI and cloud security." }),
  "Hear practitioners discuss applied AI and cloud security.",
);
check(
  "copy from a previous numbered edition is hidden",
  usableEventSummary({
    title: "Build & Blend #12: Doing Things AI",
    summary: "At Build & Blend #11, an attendee brought a problem from home.",
  }),
  null,
);
check(
  "copy for the current numbered edition remains visible",
  usableEventSummary({
    title: "Build & Blend #12: Doing Things AI",
    summary: "Build & Blend #12 is an open-laptop session for people working on AI projects.",
  }),
  "Build & Blend #12 is an open-laptop session for people working on AI projects.",
);
check("session labels become learning outcomes", actionizeEventHighlight("Sessions on AI and AI agents"), "Learn about AI and AI agents");
check("panel labels become listening outcomes", actionizeEventHighlight("Panel on DevOps and cloud security"), "Hear perspectives on DevOps and cloud security");
check("Q&A labels become participation outcomes", actionizeEventHighlight("Q&A with technical perspectives"), "Ask questions in the technical Q&A");
check(
  "listing title matcher finds the matching detail page",
  eventTitlesLikelyMatch(
    "She Builds Tech - Skillup Tamilnadu Session 9",
    "She Builds Tech – Skillup Tamilnadu Session 9 | Azure Developer Community",
  ),
  true,
);
check(
  "listing title matcher rejects a different event",
  eventTitleMatchScore("She Builds Tech - Skillup Tamilnadu Session 9", "Chennai Founders Mixer") < 0.78,
  true,
);

const shortened = truncateSeoText("word ".repeat(50), 40);
check("SEO text respects maximum length", shortened.length <= 40, true);
check("SEO text uses an ellipsis when shortened", shortened.endsWith("…"), true);
check("description prefers source summary", eventSeoDescription(event), event.summary);
check("JSON-LD escapes script-closing input", serializeJsonLd({ name: "</script>" }).includes("<"), false);

const schema = eventStructuredData(event)!;
check("dated event produces Event schema", schema["@type"], "Event");
check("canonical URL is the schema URL", schema.url, "https://scene044.in/events/ai-and-product-night-chennai-42");
check("offline attendance mode is explicit", schema.eventAttendanceMode, "https://schema.org/OfflineEventAttendanceMode");
check("free offer stays factual", (schema.offers as Record<string, unknown>).price, "0");
check("venue address reaches structured data", ((schema.location as Record<string, unknown>).address as Record<string, unknown>).streetAddress, "Taramani, Chennai");
check("undated listing does not emit invalid Event schema", eventStructuredData({ ...event, startAt: null }), null);
check("cancelled event exposes cancellation status", eventStructuredData({ ...event, status: "cancelled" })?.eventStatus, "https://schema.org/EventCancelled");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
