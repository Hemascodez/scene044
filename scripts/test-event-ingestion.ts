import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { promises as dns } from "node:dns";
import { buildIngestionQueries, ingestionLocationAllowed, ingestionMarkets, eventIngestionMarket, EVENT_DISCOVERY_FEED_CONFIG } from "../lib/eventIngestionScope";
import { automaticPublicationIssue, publicationLimit, retryDelayMs } from "../lib/eventIngestionQuality";
import { robotsAllows, fetchEventPage } from "../lib/eventPageFetch";
import { extractEventDocument } from "../lib/extract";
import { classifyEventUrl } from "../lib/eventUrlPatterns";
import { normalizeEventCity, eventAddressRegion } from "../lib/eventLocations";
import { createExtractionRunState, refreshDiscoveryFeeds, runDiscovery, runExtraction } from "../lib/pipeline";
import type { ExtractedEvent } from "../lib/types";
import { createFirecrawlProvider, FIRECRAWL_SEARCH_GAP_MS, SearchCreditsExhaustedError, SearchRateLimitedError, selectSearchProvider } from "../lib/search";
import { parseIngestionOptions } from "./event-ingestion-options";

async function main() {
  const event: ExtractedEvent = { title: "Fixture builders meetup", summary: "A detailed source-backed description of a gathering for developers to discuss their projects and share practical engineering experiences.",
    startAt: "2099-11-28T10:00:00+05:30", endAt: "2099-11-28T12:00:00+05:30", city: "Bengaluru",
    isOnline: false, venueName: "Fixture Hall", venueAddress: "Fixture Road, Bengaluru, Karnataka",
    organizerName: "Fixture Builders", posterImageUrl: null, priceType: null, priceNote: null,
    sourceMethod: "json_ld", confidence: 1, dateEvidence: null, venueEvidence: null };
  const schema = (changes = {}) => ({ "@context": "https://schema.org", "@type": "Event", name: event.title, description: event.summary,
    startDate: event.startAt, endDate: event.endAt, organizer: { name: event.organizerName },
    location: { "@type": "Place", name: event.venueName, address: { streetAddress: "Fixture Road", addressLocality: "Bangalore", addressRegion: "Karnataka" } }, ...changes });
  const html = (node: unknown) => `<script type="application/ld+json">${JSON.stringify(node)}</script><body>Fixture event details</body>`;
  for (const city of ["Chennai", "Bangalore", "Mumbai", "Delhi", "New Delhi", "Gurgaon", "Gurugram", "Calicut", "Kochi", "Trivandrum", "Kannur", "Munnar"]) assert.ok(ingestionLocationAllowed({ ...event, city }));
  assert.ok(ingestionLocationAllowed({ ...event, city: "Pala", venueAddress: "Pala, Kerala, India" }), "smaller Kerala towns use explicit state evidence");
  assert.equal(ingestionLocationAllowed({ ...event, city: "Pune", venueAddress: "Pune, India" }), false);
  assert.equal(ingestionLocationAllowed({ ...event, city: "Kerala" }), false);
  assert.equal(normalizeEventCity("Calicut"), "Kozhikode"); assert.equal(eventAddressRegion("Kozhikode"), "Kerala");
  const queries = buildIngestionQueries();
  for (const source of ["luma.com", "meetup.com", "kynhood.com"]) assert.ok(queries.some(q => q.query_text.startsWith("Kerala ") && q.site_filter === `site:${source}`));
  assert.ok(!queries.some(q => /2026/.test(q.query_text)), "queries must not expire every January");
  assert.equal(queries.filter(q => q.priority > 0).length, 18);
  assert.ok(queries.every(q => q.discovery_market));
  assert.ok(queries.some(q => q.query_text.startsWith("Gurugram Gurgaon ") && q.discovery_market === "Gurugram"));
  assert.deepEqual(ingestionMarkets(["New Delhi", "Delhi", "Gurgaon", "Bangalore", "Cochin"]), ["Delhi", "Gurugram", "Bengaluru", "Kerala"]);
  assert.equal(eventIngestionMarket({ ...event, city: "Pala", venueAddress: "Pala, Kerala, India" }), "Kerala");
  assert.ok(!EVENT_DISCOVERY_FEED_CONFIG.some(feed => /gurugram|gurgaon/i.test(feed.url)));
  assert.deepEqual(parseIngestionOptions(["--city", "Mumbai", "--market", "Delhi,Gurgaon", "--max-publish", "0"]).markets, ["Mumbai", "Delhi", "Gurugram"]);
  assert.deepEqual(parseIngestionOptions(["--extract-only", "--item-id", "5,6", "--item-id", "5"]).itemIds, [5, 6]);
  for (const args of [["--city"], ["--city", ""], ["--city", "Mumbi"], ["--market", "Mumbai,"], ["--item-id", "1"], ["--extract-only", "--item-id", "0"], ["--max-publish", "NaN"], ["--max-minutes", "0"], ["--city", "Delhi", "--verify-only"], ["--extract-only", "--discover-only"]]) {
    assert.throws(() => parseIngestionOptions(args), `invalid CLI must fail before DB/network: ${args}`);
  }
  assert.equal(automaticPublicationIssue(event, null), null);
  assert.equal(automaticPublicationIssue({ ...event, startAt: null }, null), "precise_event_time_required");
  assert.equal(automaticPublicationIssue({ ...event, startAt: "2099-11-28" }, null), "precise_event_time_required");
  assert.equal(automaticPublicationIssue({ ...event, summary: "Join us" }, null), "insufficient_source_description");
  for (const venueName of ['Bengaluru', 'Bangalore, India', 'Bengaluru, Karnataka, India']) {
    assert.equal(automaticPublicationIssue({ ...event, venueName }, null), 'source_venue_withheld', 'a city/region/country is not a named venue');
  }
  assert.equal(automaticPublicationIssue({ ...event, city: 'New Delhi', venueName: 'New Delhi, India', venueAddress: 'New Delhi, Delhi' }, null), 'source_venue_withheld');
  assert.equal(automaticPublicationIssue({ ...event, venueName: 'Bengaluru International Centre' }, null), null, 'a real venue containing its city name remains valid');
  assert.equal(automaticPublicationIssue({ ...event, sourceMethod: "llm", confidence: 0.99 }, null), "source_evidence_review");
  assert.equal(automaticPublicationIssue({ ...event, sourceMethod: "llm", confidence: .9, dateEvidence: "November 28 at 10am", venueEvidence: "Fixture Hall Bengaluru" }, "November 28 at 10am. Fixture Hall Bengaluru."), null);
  assert.equal(automaticPublicationIssue({ ...event, priceType: null }, null), null, "unknown price stays unknown, not free");
  assert.equal(retryDelayMs(1), 900000); assert.equal(retryDelayMs(10), 21600000);
  const robots = "User-agent: *\nDisallow: /private\nAllow: /private/public\nUser-agent: *\nDisallow: /*?keywords=*\nUser-agent: Googlebot\nDisallow: /\n";
  assert.equal(robotsAllows(robots, "https://example.com/public"), true);
  assert.equal(robotsAllows(robots, "https://example.com/private/a"), false);
  assert.equal(robotsAllows(robots, "https://example.com/private/public/a"), true);
  assert.equal(robotsAllows(robots, "https://example.com/find/?keywords=tech"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\nUser-agent: ChennaiEventsBot\nAllow: /", "https://example.com/a"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /a$", "https://example.com/abc"), true);
  assert.equal(classifyEventUrl("https://lu.ma/some-event"), "unknown", "ambiguous legacy Luma detail slugs aren't hubs");
  assert.equal(classifyEventUrl("https://luma.com/new-delhi"), "hub");
  assert.equal(classifyEventUrl("https://luma.com/gurugram"), "unknown");
  const parsed = await extractEventDocument(html(schema()), "https://luma.com/fixture");
  assert.equal(parsed.kind, "event");
  if (parsed.kind === "event") { assert.equal(parsed.event.city, "Bengaluru"); assert.equal(parsed.event.priceType, null); }
  const listing = html({ "@type": "ItemList", itemListElement: [{ "@type": "ListItem", item: { ...schema(), url: "https://luma.com/fixture" } }] });
  assert.equal((await extractEventDocument(listing, "https://luma.com/bengaluru")).kind, "event_list");
  assert.equal((await extractEventDocument(html(schema()), "https://luma.com/bengaluru")).kind, "none", "hub never impersonates one arbitrary child");
  const kyn = await extractEventDocument('<a href="/event/abcdef123456abcdef123456">Fixture workshop</a><a href="/login">Login</a>', "https://kynhood.com/eventhome");
  assert.equal(kyn.kind, "event_list"); if (kyn.kind === "event_list") assert.equal(kyn.links.length, 1);
  assert.equal((await extractEventDocument('<body></body>', "https://kynhood.com/event/abcdef123456abcdef123456")).kind, "none");
  const hydration = `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { initialData: { kind: "calendar", data: { events: [{ event: { name: "Fixture", url: "fixture", visibility: "public", start_at: event.startAt } }, { event: { name: "Hidden", url: "hidden", visibility: "private", start_at: event.startAt } }] } } } } })}</script>`;
  const calendar = await extractEventDocument(hydration, "https://luma.com/builders");
  assert.equal(calendar.kind, "event_list"); if (calendar.kind === "event_list") assert.equal(calendar.links.length, 1);
  assert.equal((await extractEventDocument(html(schema({ eventStatus: "https://schema.org/EventCancelled" })), "https://luma.com/fixture")).kind, "none");
  assert.equal((await extractEventDocument(html([schema(), schema({ eventStatus: "https://schema.org/EventCancelled", name: "Unrelated cancelled recommendation" })]), "https://luma.com/fixture")).kind, "event");
  const kynUrl = "https://kynhood.com/event/abcdef123456abcdef123456";
  const kynStream = (showVenue: boolean) => `<script>self.__next_f.push(${JSON.stringify([1,
    '22:T123,' + JSON.stringify(schema({ url: kynUrl, location: { "@type": "Place", name: "Adyar", address: "Private fixture street, Chennai" } }))
    + 'e:{"eventData":' + JSON.stringify({ eventId: "abcdef123456abcdef123456", locations: [{ showVenue, venue: "Public Reading Hall, Adyar", private_coordinates: "NEVER_IMPORT" }] }) + '}'])})</script>`;
  const embeddedKyn = await extractEventDocument(kynStream(true), kynUrl);
  assert.equal(embeddedKyn.kind, "event");
  if (embeddedKyn.kind === "event") { assert.equal(embeddedKyn.event.city, "Chennai"); assert.equal(embeddedKyn.event.venueAddress, "Public Reading Hall, Adyar"); assert.ok(!JSON.stringify(embeddedKyn).includes("NEVER_IMPORT")); }
  const hiddenKyn = await extractEventDocument(kynStream(false), kynUrl);
  if (hiddenKyn.kind === "event") assert.equal(hiddenKyn.event.venueAddress, null, "hidden locations aren't imported from hydration data");

  const previousFetch = globalThis.fetch, previousPool = globalThis.__pgPool;
  const previousLookup = dns.lookup;
  dns.lookup = (async () => [{ address: "93.184.216.34", family: 4 }]) as unknown as typeof dns.lookup;
  const env = { ...process.env };
  const db = new PGlite(); let fetches = 0, failSourceInsert = false, rejectDuringEditorial = false;
  const query = async (sql: string, params?: unknown[]) => {
    if (failSourceInsert && sql.includes("INSERT INTO event_sources")) throw new Error("Fixture source insert failure");
    if (sql.includes("pg_try_advisory_lock")) return { rows: [{ held: true }], rowCount: 1 };
    if (sql.includes("pg_advisory_unlock")) return { rows: [], rowCount: 1 };
    const result = await db.query(sql, params); return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  globalThis.__pgPool = { query, connect: async () => ({ query, release() {} }) } as unknown as NonNullable<typeof globalThis.__pgPool>;
  try {
    await db.exec(readFileSync("db/schema.sql", "utf8"));
    const migration = readFileSync("db/migrations/2026-11-23-event-ingestion.sql", "utf8");
    await db.exec(migration); await db.exec(migration);
    // SQL in seed-sources must parse, and must preserve manual trust changes.
    const sourceCode = readFileSync("scripts/seed-sources.ts", "utf8");
    const sourceSql = sourceCode.match(/`(INSERT INTO sources[\s\S]+?)`/)![1];
    await query(sourceSql, ["luma.com", "Luma", "blocked", false]);
    await query(sourceSql, ["luma.com", "Luma", "auto_fetch", true]);
    assert.equal((await db.query<{ trust_tier: string }>("SELECT trust_tier FROM sources WHERE domain='luma.com'")).rows[0].trust_tier, "blocked");
    await db.exec("UPDATE sources SET trust_tier='auto_fetch' WHERE domain='luma.com'; INSERT INTO sources(domain,name,trust_tier) VALUES('kynhood.com','KYN','auto_fetch')");
    assert.equal(await refreshDiscoveryFeeds(), 4); assert.equal(await refreshDiscoveryFeeds(), 0);
    await db.exec("UPDATE discovery_items SET status='expanded',next_attempt_at=now()-interval '1 minute' WHERE url='https://luma.com/bengaluru'");
    assert.equal(await refreshDiscoveryFeeds(), 1, "due calendar can discover new children on a later run");
    await db.exec("UPDATE discovery_items SET status='curator_rejected' WHERE url='https://luma.com/bengaluru'");
    assert.equal(await refreshDiscoveryFeeds(), 0, "manual rejection is never revived");
    process.env.EVENT_MAX_PUBLISH_PER_RUN = "0";
    assert.equal(publicationLimit(10), 0); assert.equal((await runExtraction()).publicationLimitReached, true);
    delete process.env.EVENT_MAX_PUBLISH_PER_RUN;
    // Keep this integration fixture narrowly scoped; all external I/O mocked.
    await db.exec("DELETE FROM discovery_items; INSERT INTO discovery_items(url,source_domain,status) VALUES('https://luma.com/fixture','luma.com','auto_processing')");
    globalThis.fetch = async (input) => {
      fetches++; const url = String(input);
      if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
      if (url === "https://luma.com/fixture") return new Response("Unavailable", { status: 503 });
      throw new Error("Unexpected external call");
    };
    const failed = await runExtraction(); assert.equal(failed.retryScheduled, 1); assert.equal(failed.rejected, 0);
    assert.equal((await db.query<{ attempt_count: number }>("SELECT attempt_count FROM discovery_items")).rows[0].attempt_count, 1);
    const notDue = await runExtraction(); assert.equal(notDue.processed, 0);
    assert.equal(notDue.rateLimited, true); assert.ok(notDue.nextRetryAt, "future retry isn't reported as an empty queue");
    await db.exec("UPDATE discovery_items SET attempt_count=3,next_attempt_at=now()-interval '1 second'; UPDATE sources SET last_fetched_at=NULL");
    const exhausted = await runExtraction(); assert.equal(exhausted.needsReview, 1);
    assert.equal((await db.query<{ status: string }>("SELECT status FROM discovery_items")).rows[0].status, "curator_pending");
    const intro = "Curious about how other developers approach everyday engineering problems? This session brings builders together at Fixture Hall in Bengaluru to discuss the projects they are working on. Expect conversations about software development, opportunities to share questions, and time to hear how other people think through practical decisions. It is a useful setting for developers who enjoy exchanging ideas with peers and reflecting on their own work. Bring a question from your current project and take part in the discussion.";
    process.env.OPENAI_API_KEY = "fixture-not-a-key";
    await db.exec("DELETE FROM discovery_items; UPDATE sources SET last_fetched_at=NULL; INSERT INTO discovery_items(url,source_domain,status) VALUES('https://luma.com/final-fixture','luma.com','auto_processing')");
    globalThis.fetch = async (input, init) => {
      fetches++; const url = String(input);
      if (url === "https://luma.com/final-fixture") return new Response(html(schema({ description: intro })), { headers: { "content-type": "text/html" } });
      if (url === "https://luma.com/curator-race") return new Response(html(schema({ name: "Curated session fixture", description: intro, startDate: "2099-12-10T10:00:00+05:30", endDate: "2099-12-10T12:00:00+05:30" })), { headers: { "content-type": "text/html" } });
      if (url.includes("api.openai.com")) {
        const payload = JSON.parse(String(init?.body)); const name = payload.tools[0].name;
        if (name === "write_story" && rejectDuringEditorial) await db.exec("UPDATE discovery_items SET status='curator_rejected' WHERE url='https://luma.com/curator-race'");
        const value = name === "categorize_event" ? { category: "tech", chennai_relevance_score: 0 }
          : { event_story: intro, gist: "Developers discuss their projects and practical engineering experiences.", what_you_get: [], registration_note: null };
        return Response.json({ id: "resp_fixture", output: [{ type: "function_call", name, arguments: JSON.stringify(value), call_id: "fixture_call" }] });
      }
      throw new Error("Unexpected live call");
    };
    failSourceInsert = true;
    const rolledBack = await runExtraction(); assert.equal(rolledBack.retryScheduled, 1);
    assert.equal((await db.query("SELECT id FROM events")).rows.length, 0, "source write failure rolls back event publication");
    failSourceInsert = false;
    await db.exec("UPDATE discovery_items SET next_attempt_at=NULL; UPDATE sources SET last_fetched_at=NULL");
    const published = await runExtraction(); assert.equal(published.extracted, 1, "Bengaluru event publishes even with zero Chennai score");
    assert.equal((await db.query<{ city: string }>("SELECT city FROM events")).rows[0].city, "Bengaluru");
    assert.equal((await db.query("SELECT id FROM event_sources")).rows.length, 1);
    assert.equal((await db.query<{ status: string }>("SELECT status FROM discovery_items")).rows[0].status, "auto_extracted");
    assert.equal((await runExtraction()).extracted, 0, "repeat run cannot publish same queue item again");
    rejectDuringEditorial = true;
    await db.exec("UPDATE sources SET last_fetched_at=NULL; INSERT INTO discovery_items(url,source_domain,status) VALUES('https://luma.com/curator-race','luma.com','auto_processing')");
    assert.equal((await runExtraction()).extracted, 0);
    assert.equal((await db.query("SELECT id FROM events")).rows.length, 1, "curator rejection during AI work prevents publication");
    assert.equal((await db.query<{ status: string }>("SELECT status FROM discovery_items WHERE url='https://luma.com/curator-race'")).rows[0].status, "curator_rejected", "lease fencing preserves current curator decision");

    // New Delhi is a metro discovery hint: its child can actually be Gurugram.
    // Preserve pre-existing pending/rejected children even when listed again.
    await db.exec(`UPDATE event_sources SET discovery_item_id=NULL; DELETE FROM discovery_items; UPDATE sources SET last_fetched_at=NULL;
      INSERT INTO discovery_items(url,source_domain,status,rejection_reason) VALUES
      ('https://luma.com/old-review','luma.com','curator_pending','outside_ingestion_region'),
      ('https://luma.com/user-rejected','luma.com','curator_rejected','user decision')`);
    assert.equal(await refreshDiscoveryFeeds({ markets: ["New Delhi"] }), 1);
    let modelCalls = 0;
    const modelResponse = (init?: RequestInit) => {
      modelCalls++;
      const name = JSON.parse(String(init?.body)).tools[0].name;
      const value = name === "categorize_event" ? { category: "tech", chennai_relevance_score: 0 }
        : { event_story: intro, gist: "Developers discuss practical engineering experiences.", what_you_get: [], registration_note: null };
      return Response.json({ id: "resp_fixture", output: [{ type: "function_call", name, arguments: JSON.stringify(value), call_id: "fixture_call" }] });
    };
    const citySchema = (city: string, index = 0) => schema({ name: `Fixture unique gathering ${index}`, description: intro,
      startDate: new Date(Date.UTC(2099, 0, 1 + index * 7, 6)).toISOString(),
      endDate: new Date(Date.UTC(2099, 0, 1 + index * 7, 8)).toISOString(),
      location: { "@type": "Place", name: "Fixture Hall", address: { streetAddress: "Fixture Road", addressLocality: city } } });
    const detailCities = new Map<string, { city: string; index: number }>([["https://luma.com/metro-child", { city: "Gurgaon", index: 1 }]]);
    globalThis.fetch = async (input, init) => {
      fetches++; const url = String(input);
      if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /");
      if (url.includes("api.openai.com")) return modelResponse(init);
      if (url === "https://luma.com/new-delhi") return new Response(html({ "@type": "ItemList", itemListElement:
        ["metro-child", "old-review", "user-rejected"].map(slug => ({ "@type": "ListItem", item: { ...citySchema("Gurgaon"), url: `https://luma.com/${slug}` } })) }), { headers: { "content-type": "text/html" } });
      const detail = detailCities.get(url);
      if (detail) return new Response(html(citySchema(detail.city, detail.index)), { headers: { "content-type": "text/html" } });
      throw new Error(`Unexpected fixture call: ${url}`);
    };
    const scopedState = createExtractionRunState();
    assert.equal((await runExtraction({ markets: ["Delhi"], runState: scopedState })).expandedListings, 1);
    const child = (await db.query<{ id: number; discovery_market: string }>("SELECT id,discovery_market FROM discovery_items WHERE url='https://luma.com/metro-child'")).rows[0];
    assert.equal(child.discovery_market, "Delhi");
    await db.exec("UPDATE sources SET last_fetched_at=NULL");
    const beforeScopedModels = modelCalls;
    const mismatch = await runExtraction({ markets: ["Delhi"], runState: scopedState });
    assert.equal(mismatch.processed, 1); assert.equal(mismatch.extracted, 0);
    assert.equal(modelCalls, beforeScopedModels, "wrong detail city stops before classifier/editorial");
    assert.deepEqual((await db.query("SELECT status,attempt_count,lease_token,next_attempt_at FROM discovery_items WHERE id=$1", [child.id])).rows[0],
      { status: "auto_processing", attempt_count: 0, lease_token: null, next_attempt_at: null });
    assert.equal((await runExtraction({ markets: ["Delhi"], runState: scopedState })).processed, 0, "same recommendation is skipped across passes");
    await db.exec("UPDATE sources SET last_fetched_at=NULL");
    const correctedState = createExtractionRunState();
    assert.equal((await runExtraction({ markets: ["Gurgaon"], itemIds: [child.id], runState: correctedState })).extracted, 1);
    assert.equal((await db.query<{ city: string }>("SELECT city FROM events WHERE primary_source_url='https://luma.com/metro-child'")).rows[0].city, "Gurugram");
    assert.equal(correctedState.publishedByMarket.Gurugram, 1); assert.equal(correctedState.publishedByMarket.Delhi, undefined);
    await db.exec(migration);
    assert.equal((await db.query<{ status: string }>("SELECT status FROM discovery_items WHERE url='https://luma.com/old-review'")).rows[0].status, "curator_pending");
    assert.equal((await db.query<{ status: string }>("SELECT status FROM discovery_items WHERE url='https://luma.com/user-rejected'")).rows[0].status, "curator_rejected");

    // A previously expanded, due feed must refresh before a market's old
    // unattempted children consume the entire ten-publication budget.
    await db.exec("UPDATE event_sources SET discovery_item_id=NULL; DELETE FROM discovery_items; UPDATE sources SET last_fetched_at=NULL");
    for (let i = 0; i < 12; i++) {
      const url = `https://luma.com/refresh-backlog-${i}`;
      detailCities.set(url, { city: "New Delhi", index: 40 + i });
      await query(`INSERT INTO discovery_items(url,source_domain,status,discovery_market,discovered_at)
        VALUES($1,'luma.com','auto_processing','Delhi',now()-interval '2 days')`, [url]);
    }
    await db.exec(`INSERT INTO discovery_items(url,source_domain,status,discovery_market,last_attempt_at,next_attempt_at)
      VALUES('https://luma.com/new-delhi','luma.com','expanded','Delhi',now()-interval '1 day',now()-interval '1 minute')`);
    assert.equal(await refreshDiscoveryFeeds({ markets: ["Delhi"] }), 1);
    const refreshedPass = await runExtraction({ markets: ["Delhi"], maxPublish: 10 });
    assert.equal(refreshedPass.expandedListings, 1, "due feed wins within its market before twelve unattempted children");
    assert.equal(refreshedPass.processed, 1, "one source fetch per domain/pass still applies");
    assert.equal(refreshedPass.extracted, 0);
    assert.equal((await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM discovery_items
      WHERE url LIKE 'https://luma.com/refresh-backlog-%' AND last_attempt_at IS NULL`)).rows[0].count, 12);
    assert.equal((await db.query<{ deferred: boolean }>(`SELECT status='expanded' AND next_attempt_at > now()+interval '5 hours 59 minutes'
      AND next_attempt_at < now()+interval '6 hours 1 minute' AS deferred
      FROM discovery_items WHERE url='https://luma.com/new-delhi'`)).rows[0].deferred, true, "existing feed refresh interval is preserved");
    assert.equal(await refreshDiscoveryFeeds({ markets: ["Delhi"] }), 0, "feed is not requeued again before its refresh interval");

    // A flood of fresh Bengaluru children cannot consume the ten-publication
    // budget ahead of old Mumbai/Delhi/Gurugram or legacy NULL-hint candidates.
    await db.exec("UPDATE event_sources SET discovery_item_id=NULL; DELETE FROM discovery_items; UPDATE sources SET last_fetched_at=NULL");
    const fairState = createExtractionRunState();
    let fixtureIndex = 3;
    for (const [market, count] of [["Bengaluru", 14], ["Mumbai", 4], ["Delhi", 4], ["Gurugram", 4], [null, 1]] as const) {
      for (let j = 0; j < count; j++) {
        const url = `https://luma.com/fair-${fixtureIndex}`;
        detailCities.set(url, { city: market ?? "Chennai", index: fixtureIndex++ });
        await query(`INSERT INTO discovery_items(url,source_domain,status,discovery_market,discovered_at)
          VALUES($1,'luma.com','auto_processing',$2,now()+($3::int * interval '1 second'))`, [url, market, j]);
      }
    }
    let totalPublished = 0;
    for (let pass = 0; pass < 15 && totalPublished < 10; pass++) {
      // Advance only the fixture source's politeness clock; no real wait/network.
      await db.exec("UPDATE sources SET last_fetched_at=NULL");
      const result = await runExtraction({ maxPublish: 10 - totalPublished, runState: fairState });
      totalPublished += result.extracted;
    }
    assert.equal(totalPublished, 10);
    for (const market of ["Bengaluru", "Mumbai", "Delhi", "Gurugram", "Chennai"]) assert.ok(fairState.publishedByMarket[market]! >= 1, `${market} participates before the cap`);
    assert.ok(fairState.publishedByMarket.Bengaluru <= 3, "fresh children do not monopolize cap");
    assert.equal(fairState.processedByMarket.Unknown, 1, "legacy NULL market remains eligible");
    assert.equal((await runExtraction({ maxPublish: 0, runState: fairState })).processed, 0);
    await assert.rejects(runExtraction({ markets: ["Mumbi"] }));
    await assert.rejects(runExtraction({ itemIds: [0] }));
    // Explicit IDs never make pending/rejected or unapproved sources eligible.
    await db.exec(`INSERT INTO sources(domain,name,trust_tier) VALUES('unapproved.example','Fixture','curator_only');
      INSERT INTO discovery_items(url,source_domain,status) VALUES
      ('https://luma.com/pending-id','luma.com','curator_pending'),
      ('https://luma.com/rejected-id','luma.com','curator_rejected'),
      ('https://unapproved.example/fixture','unapproved.example','auto_processing')`);
    const forbiddenIds = (await db.query<{ id: number }>("SELECT id FROM discovery_items WHERE url IN ('https://luma.com/pending-id','https://luma.com/rejected-id','https://unapproved.example/fixture')")).rows.map(row => row.id);
    assert.equal((await runExtraction({ itemIds: forbiddenIds })).processed, 0);

    process.env.SEARCH_PROVIDER = "firecrawl"; process.env.FIRECRAWL_API_KEY = "fixture-not-a-key";
    globalThis.fetch = async (input, init) => {
      fetches++; assert.equal(String(input), "https://api.firecrawl.dev/v2/search");
      const payload = JSON.parse(String(init?.body)); assert.equal(payload.location, "India");
      return Response.json({ success: true, data: { web: [{ url: "https://luma.com/one", title: "One" }, { url: "https://unapproved.example/two", title: "Wrong domain" }] } });
    };
    assert.equal((await selectSearchProvider().search("Mumbai events", "site:luma.com")).results.length, 1);
    const provider = { name: "fixture", suggestedQueriesPerRun: 1, missingConfig: () => [], search: async () => ({ results: [] }) };
    assert.equal((await runDiscovery({ provider })).queriesRun, 0);
    // Seed SQL and metadata backfill parse without changing manual active flags.
    const seedCode = readFileSync("scripts/seed-queries.ts", "utf8");
    const seedSql = seedCode.match(/`(INSERT INTO search_queries[\s\S]+?)`/)![1];
    for (const row of queries) await query(seedSql, [row.query_text, row.category_hint, row.site_filter, row.priority, row.discovery_market]);
    const seededMumbai = queries.find(row => row.discovery_market === "Mumbai")!;
    await db.exec("UPDATE search_queries SET active=false WHERE query_text LIKE 'Mumbai %'");
    await query(seedSql, [seededMumbai.query_text, null, seededMumbai.site_filter, seededMumbai.priority, "Mumbai"]);
    assert.equal((await runDiscovery({ markets: ["Mumbai"], provider })).queriesRun, 0, "seeding never reactivates disabled query");
    const seenQueries: string[] = [];
    const discovery = await runDiscovery({ markets: ["New Delhi"], limit: 20, provider: { ...provider, search: async text => {
      seenQueries.push(text);
      return { results: [{ title: "Fixture hit", snippet: "Upcoming gathering", link: "https://luma.com/search-metro-hit" }] };
    } } });
    assert.equal(discovery.queriesRun, 3); assert.ok(seenQueries.every(text => text.startsWith("Delhi New Delhi ")));
    assert.equal((await db.query<{ discovery_market: string }>("SELECT discovery_market FROM discovery_items WHERE url='https://luma.com/search-metro-hit'")).rows[0].discovery_market, "Delhi");

    // Fake-clock provider tests exercise every wait/retry without spending any
    // credits or sleeping. Concurrent callers must share the same pacing queue.
    let now = Date.UTC(2026, 10, 24), requests = 0;
    let responses: Response[] = [];
    const starts: number[] = [], waits: number[] = [];
    const clock = { now: () => now, sleep: async (ms: number) => { waits.push(ms); now += ms; } };
    globalThis.fetch = async () => { fetches++; requests++; starts.push(now); return responses.shift() ?? Response.json({ data: { web: [] } }); };
    const paced = createFirecrawlProvider(clock);
    await Promise.all(Array.from({ length: 20 }, () => paced.search("Fixture", null)));
    assert.equal(requests, 20);
    assert.ok(starts.slice(1).every((start, i) => start - starts[i] >= FIRECRAWL_SEARCH_GAP_MS));
    responses = [new Response("", { status: 429, headers: { "retry-after": "12" } }), Response.json({ data: { web: [] } })];
    requests = 0; waits.length = 0;
    await createFirecrawlProvider(clock).search("Retry", null);
    assert.equal(requests, 2); assert.deepEqual(waits, [12_000]);
    responses = [new Response("", { status: 429 }), new Response("", { status: 429 })];
    requests = 0; waits.length = 0;
    await assert.rejects(createFirecrawlProvider(clock).search("Stop", null), SearchRateLimitedError);
    assert.equal(requests, 2); assert.deepEqual(waits, [60_000]);
    responses = [new Response("", { status: 429, headers: { "retry-after": "120" } })];
    requests = 0; waits.length = 0;
    await assert.rejects(createFirecrawlProvider(clock).search("Long quota", null), SearchRateLimitedError);
    assert.equal(requests, 1); assert.deepEqual(waits, []);
    responses = [new Response("", { status: 402 })]; requests = 0;
    await assert.rejects(createFirecrawlProvider(clock).search("No credits", null), SearchCreditsExhaustedError);
    assert.equal(requests, 1);
    responses = [new Response("", { status: 402 })]; requests = 0;
    assert.ok((await runDiscovery({ markets: ["Delhi"], provider: createFirecrawlProvider(clock) })).stoppedEarly?.includes("credits exhausted"));
    assert.equal(requests, 1, "402 stops entire discovery loop");
    process.env.EVENT_RENDER_ENABLED = "true";
    let renderCalls = 0;
    globalThis.fetch = async (input) => {
      const url = String(input); fetches++;
      if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
      if (url.includes("firecrawl.dev")) { renderCalls++; throw new Error("Must not render denied content"); }
      return new Response("<html>Verify you are human CAPTCHA</html>", { headers: { "content-type": "text/html" } });
    };
    const challenge = await fetchEventPage(kynUrl, ["kynhood.com"]);
    assert.equal(challenge.ok, false); assert.equal(renderCalls, 0);
    globalThis.fetch = async (input) => {
      const url = String(input); fetches++;
      if (url.includes("firecrawl.dev")) { renderCalls++; throw new Error("Must not render non-event paths"); }
      return new Response("<html></html>", { headers: { "content-type": "text/html" } });
    };
    await fetchEventPage("https://kynhood.com/eventhome-admin", ["kynhood.com"]);
    await fetchEventPage(kynUrl + "/private", ["kynhood.com"]);
    assert.equal(renderCalls, 0);
    // robots denial is not a reason to try a renderer or stealth request.
    globalThis.fetch = async (input) => { fetches++; assert.ok(String(input).endsWith("/robots.txt")); return new Response("User-agent: *\nDisallow: /", { headers: { "content-type": "text/plain" } }); };
    process.env.EVENT_RENDER_ENABLED = "true";
    const denied = await fetchEventPage("https://www.meetup.com/fixture/events/12345/", ["meetup.com"]);
    assert.equal(denied.ok, false); if (!denied.ok) assert.equal(denied.reason, "robots_disallowed");
    console.log(`PASS event ingestion: location scope, Kerala aliases, non-expiring queries, robots groups, platform detail/listing fixtures, unknown-price preservation, evidence gates, additive migration, manual source/curator protection, recurring feeds, leased bounded retries, India search and domain filtering (${fetches} mocked fetches; no live DB or provider calls)`);
  } finally {
    globalThis.fetch = previousFetch; globalThis.__pgPool = previousPool; dns.lookup = previousLookup;
    for (const key of ["SEARCH_PROVIDER", "FIRECRAWL_API_KEY", "EVENT_RENDER_ENABLED", "EVENT_MAX_PUBLISH_PER_RUN", "OPENAI_API_KEY"]) {
      if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
    }
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
