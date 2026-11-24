import assert from 'node:assert/strict';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { load } from 'cheerio';
import type { Pool } from 'pg';
import type { PublicEventDetail } from '../lib/events';
import { activeCityHubs, cityHubCity, cityHubForEvent, cityHubLastModified, cityHubPath, eventsForCityHub, getCityHub, supportedCityHubs } from '../lib/cityEvents';
import { cityHubMetadata, cityHubSitemapEntries, cityHubStructuredData } from '../lib/cityEventSeo';
import { eventBreadcrumbStructuredData, eventPath, eventSeoTitle, serializeJsonLd } from '../lib/seo';
import CityPage, { generateMetadata } from '../app/events/city/[city]/page';
import sitemap from '../app/sitemap';
import Home from '../app/page';
import { TabbedFeed } from '../components/scene/TabbedFeed';

const router: AppRouterInstance = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, bfcacheId: 'city-test' };
const render = (node: ReactNode) => load(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, node)));
const now = new Date('2099-11-24T04:30:00Z');
const base: PublicEventDetail = {
  id: 1, title: 'Community meetup', summary: 'Published details from the organiser.', gist: null,
  highlights: [], tags: [], isPromoted: false, registrationNote: null, category: 'tech',
  startAt: '2099-11-28T04:30:00Z', endAt: '2099-11-28T08:30:00Z', isOnline: false,
  city: 'Chennai', venueName: 'Community Hall', venueAddress: 'Chennai, Tamil Nadu',
  organizerName: 'Community', posterImageUrl: null, priceType: null, priceNote: null,
  primarySourceDomain: 'example.com', primarySourceUrl: 'https://example.com/register', otherSourceDomains: [],
  status: 'live', discoveredAt: '2026-10-01T00:00:00Z', lastVerifiedAt: null, updatedAt: '2026-10-12T00:00:00Z',
};
const event = (id: number, fields: Partial<PublicEventDetail>): PublicEventDetail => ({ ...base, id, ...fields });
const events = [
  base,
  event(2, { city: ' Bangalore ', venueAddress: 'Bengaluru, Karnataka' }),
  event(3, { city: 'Bengaluru', startAt: '2099-11-27T04:30:00Z', endAt: null, status: 'updated', updatedAt: '2026-10-20T00:00:00Z' }),
  event(4, { title: 'Grafana Delhi', city: 'Gurugram', venueAddress: 'Gurugram, Haryana' }),
  event(5, { title: 'Primewise Gurgaon', city: 'New Delhi', venueAddress: 'New Delhi' }),
  event(6, { city: 'Delhi', venueAddress: 'Delhi' }),
  event(7, { city: 'Bengaluru', isOnline: true }),
  event(8, { city: 'Bengaluru', startAt: null }),
  event(9, { city: 'Bengaluru', status: 'cancelled', updatedAt: '2026-11-01T00:00:00Z' }),
  event(10, { city: 'Bengaluru', status: 'postponed' }),
  event(11, { city: 'Bengaluru', startAt: '2000-01-01T00:00:00Z', endAt: null }),
  event(12, { city: 'Bengaluru', startAt: 'invalid' }),
  event(13, { city: 'Bengaluru', endAt: 'invalid' }),
  event(14, { city: 'Bengaluru', status: 'expired' }),
  event(15, { city: 'Kochi', venueAddress: 'Kochi, Kerala' }),
  event(16, { city: 'Cherthala', venueAddress: 'Town Hall, Cherthala, Kerala 688524, India' }),
  event(17, { city: 'Random City', venueAddress: 'India' }),
  event(18, { city: 'Mumbai', isOnline: true }),
];

async function main() {
  const before = JSON.stringify(events);
  assert.equal(cityHubCity('Gurgaon'), 'Gurugram');
  assert.equal(cityHubCity('New Delhi'), 'Delhi');
  assert.equal(getCityHub('bangalore', events)?.slug, 'bengaluru');
  assert.equal(getCityHub('new-delhi', events)?.slug, 'delhi');
  assert.equal(getCityHub('gurgaon', events)?.slug, 'gurugram');
  assert.equal(getCityHub('cochin', events)?.slug, 'kochi');
  for (const slug of ['unknown-city', 'kerala', 'online', 'chennai?city=delhi', '../delhi', 'constructor', 'random-city']) assert.equal(getCityHub(slug, events), null);
  const hub = getCityHub('bengaluru', events)!;
  const filtered = eventsForCityHub([...events, events[1]], hub, now);
  assert.deepEqual(filtered.map(e => e.id), [3, 2], 'actual city only, chronological, unique, dated, offline, not cancelled/postponed/expired');
  assert.deepEqual(eventsForCityHub(events, getCityHub('delhi', events)!, now).map(e => e.id), [5, 6], 'New Delhi and Delhi share one hub; misleading Gurgaon title cannot override actual city');
  assert.deepEqual(eventsForCityHub(events, getCityHub('gurugram', events)!, now).map(e => e.id), [4], 'Grafana Delhi is actually in Gurugram');
  assert.deepEqual(eventsForCityHub(events, getCityHub('chennai', events)!, now).map(e => e.id), [1], 'no intercity or online leakage into Chennai');
  assert.match(eventSeoTitle(events[3]), /Grafana Delhi — Gurugram/);
  assert.match(eventSeoTitle(events[4]), /Primewise Gurgaon — New Delhi/);
  assert.equal(events[4].city, 'New Delhi', 'hub canonical must not mutate detail location');
  assert.equal(cityHubForEvent(events[3])?.slug, 'gurugram');
  assert.equal(cityHubForEvent(events[6]), null, 'online events have no city backlink');
  assert.equal((eventBreadcrumbStructuredData(events[3]).itemListElement as { item: string }[])[1].item, 'https://scene044.in/events/city/gurugram');
  assert.equal(getCityHub('cherthala', events)?.city, 'Cherthala', 'new Kerala town comes from real event location/address');
  assert.equal(getCityHub('cherthala', [event(50, { city: 'Cherthala', isOnline: true, venueAddress: 'Kerala' })]), null);
  assert.equal(supportedCityHubs([]).length, 8, 'keep the stable destination set small');
  assert.ok(!activeCityHubs(events, now).some(h => h.city === 'Mumbai'), 'online or empty cities cannot create indexed destinations');
  assert.equal(eventsForCityHub([event(40, { startAt: '2099-11-24T03:00:00Z', endAt: '2099-11-24T06:00:00Z' })], getCityHub('chennai', [])!, now).length, 1, 'ongoing physical event remains useful');
  assert.equal(eventsForCityHub([event(40, { startAt: '2099-11-24T01:00:00Z', endAt: now.toISOString() })], getCityHub('chennai', [])!, now).length, 0, 'finished events get no 12-hour grace on a hub');
  assert.equal(eventsForCityHub([event(40, { endAt: base.startAt })], getCityHub('chennai', [])!, now).length, 0, 'invalid date ranges require review');
  assert.equal(eventsForCityHub([event(40, { endAt: '2101-01-01T00:00:00Z' })], getCityHub('chennai', [])!, now).length, 0, 'suspicious multi-year range is withheld');

  const meta = cityHubMetadata(hub, filtered);
  assert.equal(meta.alternates?.canonical, '/events/city/bengaluru');
  assert.equal(meta.title, 'Upcoming Events in Bengaluru | SCENE');
  assert.ok(meta.description && meta.description.length <= 160 && meta.description.includes('2 upcoming'));
  assert.deepEqual(meta.robots, { index: true, follow: true });
  assert.deepEqual(cityHubMetadata(getCityHub('mumbai', [])!, []).robots, { index: false, follow: true });
  const schema = cityHubStructuredData(hub, filtered);
  assert.equal(schema['@type'], 'CollectionPage');
  assert.equal(schema.mainEntity.numberOfItems, 2);
  assert.deepEqual(schema.mainEntity.itemListElement.map(e => e.url), filtered.map(e => `https://scene044.in${eventPath(e)}`));
  assert.deepEqual(schema.mainEntity.itemListElement.map(e => e.position), [1, 2]);
  assert.ok(!serializeJsonLd(schema).includes('"@type":"Event"'), 'city collection does not claim to be an Event');
  assert.ok(!serializeJsonLd(cityHubStructuredData(hub, [event(80, { title: '</script><script>alert(1)</script>' })])).includes('</script>'));
  const entries = cityHubSitemapEntries(events, now);
  assert.equal(entries.find(e => e.url.endsWith('/bengaluru'))?.lastModified?.toString(), new Date('2026-10-20T00:00:00Z').toString());
  assert.ok(!entries.some(e => /(?:mumbai|bangalore|new-delhi|gurgaon|random-city)$/.test(e.url)));
  assert.deepEqual(cityHubSitemapEntries([], now), [], 'no empty city URLs in sitemap');
  assert.equal(cityHubLastModified([event(81, { updatedAt: 'invalid' })], now), undefined);
  assert.equal(cityHubLastModified([event(81, { updatedAt: '2101-01-01T00:00:00Z' })], now), undefined, 'future/request time is never factual lastmod');
  assert.equal('lastModified' in cityHubSitemapEntries([event(81, { updatedAt: 'invalid' })], now)[0], false);

  const previousPool = globalThis.__pgPool;
  const sql: string[] = [];
  let dbEvents = events;
  let failed = false;
  globalThis.__pgPool = { query: async (statement: string) => {
    assert.match(statement.trim(), /^SELECT\b/i, 'this test forbids every database mutation');
    sql.push(statement);
    if (failed) throw new Error('fixture database unavailable');
    if (statement.includes('FROM events e')) return { rows: dbEvents.map(e => ({ ...e, sourceDomains: [] })) };
    if (statement.includes('FROM events WHERE id = ANY')) return { rows: dbEvents.map(e => ({ id: e.id, updatedAt: e.updatedAt, venueAddress: e.venueAddress })) };
    if (statement.includes('FROM venues')) return { rows: [] };
    throw new Error(`Unexpected query: ${statement}`);
  } } as unknown as Pool;
  try {
    const props = (city: string) => ({ params: Promise.resolve({ city }) });
    const rendered = render(await CityPage(props('bengaluru')));
    assert.equal(rendered('h1').text(), 'Upcoming events in Bengaluru');
    assert.equal(rendered('main > ol > li').length, 2, 'city listings exist in server-rendered HTML');
    const renderedSchema = JSON.parse(rendered('script[type="application/ld+json"]').text());
    assert.equal(renderedSchema.mainEntity.numberOfItems, rendered('main > ol > li').length);
    assert.deepEqual(rendered('main > ol > li h2 a').map((_, el) => rendered(el).attr('href')).get(), renderedSchema.mainEntity.itemListElement.map((e: { url: string }) => new URL(e.url).pathname));
    assert.ok(!rendered('main > ol').text().includes('Free entry'), 'unknown prices are not advertised as free');
    assert.equal(rendered('footer a[href="/events/city/kochi"]').length, 1);
    assert.equal((await generateMetadata(props('bengaluru'))).alternates?.canonical, cityHubPath(hub));
    const empty = render(await CityPage(props('mumbai')));
    assert.match(empty('main').text(), /No upcoming in-person events listed in Mumbai right now/);
    assert.deepEqual((await generateMetadata(props('mumbai'))).robots, { index: false, follow: true });
    for (const [alias, canonical] of [['bangalore', 'bengaluru'], ['gurgaon', 'gurugram'], ['new-delhi', 'delhi'], ['Bengaluru', 'bengaluru']]) {
      await assert.rejects(CityPage(props(alias)), (err: unknown) => (err as { digest?: string }).digest === `NEXT_REDIRECT;replace;/events/city/${canonical};308;`);
    }
    await assert.rejects(CityPage(props('unknown-city')), (err: unknown) => (err as { digest?: string }).digest === 'NEXT_HTTP_ERROR_FALLBACK;404');
    const liveSitemap = await sitemap();
    assert.ok(liveSitemap.some(e => e.url === 'https://scene044.in/events/city/bengaluru'));
    assert.ok(!liveSitemap.some(e => e.url === 'https://scene044.in/events/city/mumbai'));
    // Invalid dates above exercise the hub guard. The existing general-feed
    // EventCard expects parsed dates, as supplied by the real public API.
    const validFeed = events.filter(e => (!e.startAt || Number.isFinite(Date.parse(e.startAt))) && (!e.endAt || Number.isFinite(Date.parse(e.endAt))));
    dbEvents = validFeed;
    const home = render(await Home({ searchParams: Promise.resolve({}) }));
    assert.ok(home('a[href="/events/city/bengaluru"]').length >= 2, 'home and footer expose crawlable city links without interaction');
    const intercity = render(createElement(TabbedFeed, { events: validFeed, has: () => false, onToggleSave() {}, lastViewedId: null, initialPreset: 'intercity' }));
    assert.equal(intercity('#panel-intercity nav a[href="/events/city/gurugram"]').length, 1);
    assert.equal(intercity('#panel-intercity nav a[href="/events/city/mumbai"]').length, 0);
    dbEvents = [];
    const emptyKnown = render(await CityPage(props('kochi')));
    assert.match(emptyKnown('main').text(), /No upcoming in-person events listed in Kochi right now/);
    assert.deepEqual((await generateMetadata(props('kochi'))).robots, { index: false, follow: true });
    failed = true;
    await assert.rejects(CityPage(props('bengaluru')), /fixture database unavailable/, 'outages are not presented as successful empty pages');
  } finally {
    globalThis.__pgPool = previousPool;
  }
  assert.equal(JSON.stringify(events), before, 'city SEO never changes source event facts');
  assert.ok(sql.length > 0);
  console.log('PASS city hubs: aliases, actual-city isolation, Delhi grouping, dynamic Kerala towns, dates/status, metadata/noindex/404/308, SSR/schema parity, crawlable links, factual sitemap and read-only mock database.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
