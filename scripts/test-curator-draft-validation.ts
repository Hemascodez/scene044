/**
 * lib/curatorDraft.ts's validateDraftForPublish() runs client-side, before the
 * publish request ever reaches the server — so a bug here blocks the Publish
 * button with an error even when the API-side check is correct. This is a
 * second, independent copy of the same http(s)-only poster check fixed in
 * app/api/admin/curator/approve/route.ts; both had to be fixed.
 */
import { validateDraftForPublish, type CuratorDraft } from "../lib/curatorDraft";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${actual} want=${expected}`}`);
}

const base: CuratorDraft = {
  title: "Test Event",
  category: "ai",
  startDate: "2026-09-20",
  startTime: "10:00",
  endDate: "",
  endTime: "",
  isOnline: true,
  venueName: "",
  venueAddress: "",
  organizerName: "",
  summary: "",
  highlights: [],
  tags: [],
  isPromoted: false,
  registrationUrl: "",
  posterImageUrl: "",
  priceType: "" as const,
  priceNote: "",
  status: "live",
};

const posterBlocked = (draft: CuratorDraft) =>
  validateDraftForPublish(draft).some((e) => e.includes("Poster URL")) ? "blocked" : "allowed";
const registrationBlocked = (draft: CuratorDraft) =>
  validateDraftForPublish(draft).some((e) => e.includes("Registration URL")) ? "blocked" : "allowed";

check("self-hosted poster no longer blocks publish", posterBlocked({ ...base, posterImageUrl: "/api/poster/10" }), "allowed");
check("larger poster id also allowed", posterBlocked({ ...base, posterImageUrl: "/api/poster/12345" }), "allowed");
check("absolute https poster still allowed", posterBlocked({ ...base, posterImageUrl: "https://example.com/x.jpg" }), "allowed");
check("empty poster allowed (optional field)", posterBlocked({ ...base, posterImageUrl: "" }), "allowed");

const validationMessages = (draft: CuratorDraft) => validateDraftForPublish(draft).join(" | ");
const withSummary = { ...base, summary: "A practical event description grounded in the organiser's published details." };
check("zero perks are valid", validationMessages(withSummary).includes("perk"), false);
check("one perk is valid", validationMessages({ ...withSummary, highlights: ["Explore practical examples"] }).includes("perk"), false);
check("three perks are valid", validationMessages({ ...withSummary, highlights: ["Explore practical examples", "Meet local peers", "Ask experts questions"] }).includes("perk"), false);
check("four perks are rejected", validationMessages({ ...withSummary, highlights: ["One", "Two", "Three", "Four"] }).includes("At most 3 perks"), true);
check("perks require a description", validationMessages({ ...base, highlights: ["Meet local peers"] }).includes("Perks require a summary"), true);
check("duplicate perks are rejected", validationMessages({ ...withSummary, highlights: ["Meet local peers", "meet local peers"] }).includes("Perks must be unique"), true);
check("overlong perks are rejected", validationMessages({ ...withSummary, highlights: ["A".repeat(73)] }).includes("72 characters"), true);
check("descriptions over 100 words are rejected", validationMessages({ ...base, summary: Array(101).fill("word").join(" ") }).includes("100 words"), true);
check("garbage poster still blocked", posterBlocked({ ...base, posterImageUrl: "not-a-url" }), "blocked");
check("path traversal in poster path still blocked", posterBlocked({ ...base, posterImageUrl: "/api/poster/../../etc/passwd" }), "blocked");
check(
  "registration URL still requires absolute http(s) — unaffected by the poster fix",
  registrationBlocked({ ...base, registrationUrl: "/api/poster/10" }),
  "blocked",
);
check("valid registration URL still passes", registrationBlocked({ ...base, registrationUrl: "https://luma.com/abc123" }), "allowed");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
