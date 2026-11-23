import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { promises as dns } from "node:dns";
import { buildIngestionQueries, ingestionLocationAllowed } from "../lib/eventIngestionScope";
import { automaticPublicationIssue, publicationLimit, retryDelayMs } from "../lib/eventIngestionQuality";
import { robotsAllows, fetchEventPage } from "../lib/eventPageFetch";
import { extractEventDocument } from "../lib/extract";
import { classifyEventUrl } from "../lib/eventUrlPatterns";
import { normalizeEventCity, eventAddressRegion } from "../lib/eventLocations";
import { refreshDiscoveryFeeds, runDiscovery, runExtraction } from "../lib/pipeline";
import type { ExtractedEvent } from "../lib/types";
import { selectSearchProvider } from "../lib/search";

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
  for (const city of ["Chennai", "Bangalore", "Mumbai", "Calicut", "Kochi", "Trivandrum", "Kannur", "Munnar"]) assert.ok(ingestionLocationAllowed({ ...event, city }));
  assert.ok(ingestionLocationAllowed({ ...event, city: "Pala", venueAddress: "Pala, Kerala, India" }), "smaller Kerala towns use explicit state evidence");
  assert.equal(ingestionLocationAllowed({ ...event, city: "Delhi", venueAddress: "Delhi, India" }), false);
  assert.equal(ingestionLocationAllowed({ ...event, city: "Kerala" }), false);
  assert.equal(normalizeEventCity("Calicut"), "Kozhikode"); assert.equal(eventAddressRegion("Kozhikode"), "Kerala");
  const queries = buildIngestionQueries();
  for (const source of ["luma.com", "meetup.com", "kynhood.com"]) assert.ok(queries.some(q => q.query_text.startsWith("Kerala ") && q.site_filter === `site:${source}`));
  assert.ok(!queries.some(q => /2026/.test(q.query_text)), "queries must not expire every January");
  assert.equal(automaticPublicationIssue(event, null), null);
  assert.equal(automaticPublicationIssue({ ...event, startAt: null }, null), "precise_event_time_required");
  assert.equal(automaticPublicationIssue({ ...event, startAt: "2099-11-28" }, null), "precise_event_time_required");
  assert.equal(automaticPublicationIssue({ ...event, summary: "Join us" }, null), "insufficient_source_description");
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
    assert.equal(await refreshDiscoveryFeeds(), 3); assert.equal(await refreshDiscoveryFeeds(), 0);
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
    process.env.SEARCH_PROVIDER = "firecrawl"; process.env.FIRECRAWL_API_KEY = "fixture-not-a-key";
    globalThis.fetch = async (input, init) => {
      fetches++; assert.equal(String(input), "https://api.firecrawl.dev/v2/search");
      const payload = JSON.parse(String(init?.body)); assert.equal(payload.location, "India");
      return Response.json({ success: true, data: { web: [{ url: "https://luma.com/one", title: "One" }, { url: "https://unapproved.example/two", title: "Wrong domain" }] } });
    };
    assert.equal((await selectSearchProvider().search("Mumbai events", "site:luma.com")).results.length, 1);
    const provider = { name: "fixture", suggestedQueriesPerRun: 1, missingConfig: () => [], search: async () => ({ results: [] }) };
    assert.equal((await runDiscovery({ provider })).queriesRun, 0);
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
