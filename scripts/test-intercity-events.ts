import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import type { Pool } from "pg";
import type { PublicEvent } from "../lib/events";
import { intercityCityOptions, isChennaiDiscoveryEvent, isIntercityEvent, normalizeEventCity } from "../lib/eventLocations";
import { matchesSearch } from "../lib/client/sceneEvent";
import { eventsForCollection, getEventCollection } from "../lib/eventDiscovery";
import { emptyCuratorDraft, validateDraftForPublish } from "../lib/curatorDraft";
import { findDuplicateEvent } from "../lib/dedup";
import { POST as publish } from "../app/api/admin/curator/approve/route";
import { POST as update } from "../app/api/admin/events/update/route";
import { TabbedFeed } from "../components/scene/TabbedFeed";

async function main() {
  const base: PublicEvent = {
    id: 1, title: "Fixture builder meetup", summary: "A community gathering.", highlights: [], tags: [],
    category: "tech", city: "Chennai", isOnline: false, venueName: "Community Hall", organizerName: "Builders",
    startAt: "2099-11-12T05:00:00Z", endAt: null, status: "live", isPromoted: false,
    posterImageUrl: null, priceType: "free", priceNote: null, primarySourceDomain: "example.com",
    otherSourceDomains: [], registrationNote: null, discoveredAt: "2099-11-01T00:00:00Z", lastVerifiedAt: null,
  };
  const event = (id: number, city: string, fields: Partial<PublicEvent> = {}): PublicEvent => ({ ...base, id, city, ...fields });
  const events = [base, event(2, " Bangalore "), event(3, "Bengaluru"), event(4, "Coimbatore"),
    event(5, "Mumbai"), event(6, "Pune"), event(7, "Bengaluru", { isOnline: true }), event(8, "TBA")];
  assert.equal(normalizeEventCity("  BANGALORE  "), "Bengaluru");
  assert.equal(normalizeEventCity("Madras"), "Chennai");
  assert.equal(normalizeEventCity("bombay"), "Mumbai");
  assert.equal(normalizeEventCity("navi mumbai"), "Navi Mumbai", "new cities need no allowlist update");
  for (const city of [null, "", "India", "Online", "TBA", "<script>", "Mumbai, Maharashtra"]) {
    assert.equal(normalizeEventCity(city), null);
  }
  assert.deepEqual(events.filter(isIntercityEvent).map(e => e.id), [2, 3, 4, 5, 6]);
  assert.deepEqual(intercityCityOptions(events), [
    { city: "Bengaluru", count: 2 }, { city: "Coimbatore", count: 1 },
    { city: "Mumbai", count: 1 }, { city: "Pune", count: 1 },
  ]);
  assert.deepEqual(events.filter(isChennaiDiscoveryEvent).map(e => e.id), [1, 7]);
  assert.equal(isIntercityEvent(event(9, "Chennai", { title: "Mumbai founders visiting Chennai" })), false);
  assert.equal(matchesSearch(event(2, "Bengaluru"), "Bangalore"), true);
  assert.equal(matchesSearch(event(2, "Bengaluru"), "Bengaluru"), true);
  assert.deepEqual(eventsForCollection(events, getEventCollection("free")!, new Date("2099-11-10T00:00:00Z")).map(e => e.id), [1, 7], "Chennai SEO pages exclude intercity events");

  const draft = { ...emptyCuratorDraft(), title: "Fixture", category: "tech" as const, startDate: "2099-11-12", venueName: "Hall", city: "Mumbai" };
  assert.deepEqual(validateDraftForPublish(draft), []);
  assert.ok(validateDraftForPublish({ ...draft, city: "" }).some(e => e.includes("city")));
  assert.deepEqual(validateDraftForPublish({ ...draft, isOnline: true, city: "" }), []);

  const markup = load(renderToStaticMarkup(createElement(TabbedFeed, {
    events: [...events, event(9, "Hyderabad", { status: "expired" })], has: () => false,
    onToggleSave: () => {}, lastViewedId: null,
  })));
  assert.equal(markup('[role="tab"]').length, 6);
  assert.equal(markup('#tab-intercity').text().replace(/\s+/g, " ").trim(), "Intercity5");
  assert.equal(markup('[role="tab"][aria-selected="true"]').attr("id"), "tab-this_week");

  const previousPool = globalThis.__pgPool;
  const previousPassword = process.env.CURATOR_PASSWORD;
  process.env.CURATOR_PASSWORD = "fixture-password";
  const statements: { sql: string; values?: unknown[] }[] = [];
  let competingCity: string | null = null;
  globalThis.__pgPool = { query: async (sql: string, values?: unknown[]) => {
    statements.push({ sql, values });
    if (sql.includes("SELECT id, url, source_domain, status FROM discovery_items")) return { rows: [{ id: 99, url: "https://example.com/new-event", source_domain: "example.com", status: "curator_pending" }] };
    if (sql.includes("SELECT COALESCE(a.canonical_id")) return { rows: [] };
    if (sql.includes("FROM events\n")) return { rows: competingCity ? [{ id: 44, title: base.title, start_at: base.startAt, is_online: false, venue_name: base.venueName, city: competingCity, organizer_name: base.organizerName, primary_source_url: "https://example.com/other-event" }] : [] };
    if (sql.includes("INSERT INTO events") || sql.includes("UPDATE events SET")) return { rows: [{ id: 100, status: "live" }] };
    return { rows: [] };
  } } as unknown as Pool;
  const headers = { Authorization: `Basic ${btoa("curator:fixture-password")}` };
  const request = (body: unknown, authorized = true) => new Request("http://localhost/api/admin/test", {
    method: "POST", body: JSON.stringify(body), headers: authorized ? headers : {},
  });
  const body = { ...base, discoveryItemId: 99, eventId: 100, city: "Bangalore", venueAddress: "Fixture address",
    primarySourceUrl: "https://example.com/new-event", chennaiRelevanceScore: 0 };
  try {
    assert.equal((await publish(request(body, false))).status, 401);
    assert.equal((await update(request(body, false))).status, 401);
    assert.equal((await publish(request({ ...body, city: "" }))).status, 400);
    assert.equal((await update(request({ ...body, city: "India" }))).status, 400);
    assert.equal(statements.length, 0, "auth and invalid cities cause no database writes");
    assert.equal((await publish(request(body))).status, 200);
    assert.equal(statements.find(s => s.sql.includes("INSERT INTO events"))?.values?.[19], "Bengaluru", "publishing persists the canonical city even with zero Chennai relevance");
    assert.equal((await update(request({ ...body, city: "Poona" }))).status, 200);
    assert.equal(statements.at(-1)?.values?.[18], "Pune", "published edits persist the city");
    assert.equal((await update(request({ ...body, city: undefined }))).status, 200);
    assert.equal(statements.at(-1)?.values?.[18], null, "legacy updates preserve existing cities");
    competingCity = "Chennai";
    const candidate = { title: base.title, startAt: base.startAt, isOnline: false, venueName: base.venueName,
      organizerName: base.organizerName, category: base.category, city: "Bangalore", url: "https://example.com/new-event" };
    assert.equal(await findDuplicateEvent(candidate), null, "same event name and venue name in different cities cannot merge");
    competingCity = "Bengaluru";
    assert.ok((await findDuplicateEvent(candidate))!.score >= 0.97, "city aliases still allow real duplicates to match");
  } finally {
    globalThis.__pgPool = previousPool;
    if (previousPassword === undefined) delete process.env.CURATOR_PASSWORD;
    else process.env.CURATOR_PASSWORD = previousPassword;
  }
  console.log("PASS Intercity: dynamic cities, aliases, city search, online separation, Chennai SEO isolation, protected publishing/editing, persistence and cross-city deduplication (mock database only)");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
