import { normalizeAdminEventUpdate } from "../lib/adminEventUpdate";

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean) {
  if (condition) pass += 1;
  else fail += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}`);
}

const valid = {
  eventId: 44,
  title: "Scene Event",
  summary: "A clear, source-backed description of the event.",
  highlights: ["Meet local peers", "Explore practical examples"],
  tags: ["Community", "Hands-on"],
  isPromoted: true,
  category: "tech",
  startAt: "2026-09-20T04:30:00.000Z",
  endAt: "2026-09-20T06:30:00.000Z",
  isOnline: false,
  venueName: "Chennai Trade Centre",
  venueAddress: "Nandambakkam, Chennai",
  organizerName: "Scene 044",
  posterImageUrl: "/api/poster/12",
  priceType: "paid",
  priceNote: "₹499",
  primarySourceUrl: "https://example.com/event?utm_source=test#tickets",
  status: "updated",
};

const normalized = normalizeAdminEventUpdate(valid);
check("accepts a complete published-event update", normalized.ok);
check("strips tracking parameters and fragments", normalized.ok && normalized.value.primarySourceUrl === "https://example.com/event");
check("keeps self-hosted poster URLs", normalized.ok && normalized.value.posterImageUrl === "/api/poster/12");
check("keeps curator tags", normalized.ok && normalized.value.tags.join(",") === "Community,Hands-on");
check("keeps promoted placement", normalized.ok && normalized.value.isPromoted === true);
check("rejects four perks", !normalizeAdminEventUpdate({ ...valid, highlights: ["One", "Two", "Three", "Four"] }).ok);
check("rejects perks without a description", !normalizeAdminEventUpdate({ ...valid, summary: null }).ok);
check("rejects duplicate perks", !normalizeAdminEventUpdate({ ...valid, highlights: ["Meet peers", "meet peers"] }).ok);
check("rejects more than six tags", !normalizeAdminEventUpdate({ ...valid, tags: ["1", "2", "3", "4", "5", "6", "7"] }).ok);
check("rejects duplicate tags", !normalizeAdminEventUpdate({ ...valid, tags: ["Community", "community"] }).ok);
check("rejects an invalid source URL", !normalizeAdminEventUpdate({ ...valid, primarySourceUrl: "javascript:alert(1)" }).ok);
check("rejects an end before the start", !normalizeAdminEventUpdate({ ...valid, endAt: "2026-09-19T06:30:00.000Z" }).ok);
check("requires a venue for in-person events", !normalizeAdminEventUpdate({ ...valid, venueName: null, venueAddress: null }).ok);

const online = normalizeAdminEventUpdate({ ...valid, isOnline: true });
check("online edits clear stale venue data", online.ok && online.value.venueName === null && online.value.venueAddress === null);

const free = normalizeAdminEventUpdate({ ...valid, priceType: "free" });
check("non-paid edits clear stale price notes", free.ok && free.value.priceNote === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
