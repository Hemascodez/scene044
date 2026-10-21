import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import type { Pool } from 'pg';
import { EVENT_COLLECTIONS, eventCollectionPath, eventCollectionDateNote, eventsForCollection, getEventCollection } from '../lib/eventDiscovery';
import { eventCollectionStructuredData, eventStructuredData, categorySeoHeading, eventSeoTitle, homeEventStructuredData } from '../lib/seo';
import { FIELD_CARDS } from '../lib/fieldCards';
import type { PublicEventDetail } from '../lib/events';
import { EventCollectionView } from '../components/scene/EventCollectionView';
import EventCollectionPage, { generateMetadata } from '../app/events/chennai/[collection]/page';
import CategoryPage, { generateMetadata as categoryMetadata } from '../app/category/[key]/page';
import sitemap from '../app/sitemap';

async function main() {
  const now = new Date('2026-10-21T04:30:00Z'); // Wednesday 10:00 IST
  const base: PublicEventDetail = {
    id: 1, title: 'Fixture Chennai meetup', summary: 'An organiser-published community session.',
    gist: null, highlights: [], tags: [], isPromoted: false, registrationNote: null,
    category: 'tech', status: 'live', startAt: '2026-10-21T12:30:00Z', endAt: null,
    isOnline: false, venueName: 'Fixture Hall', venueAddress: 'Kilpauk, Chennai', city: 'Chennai',
    organizerName: 'Fixture community', posterImageUrl: '/api/poster/1', priceType: 'free', priceNote: null,
    primarySourceUrl: 'https://example.com/register', primarySourceDomain: 'example.com', otherSourceDomains: [],
    discoveredAt: '2026-10-20T00:00:00Z', lastVerifiedAt: null, updatedAt: '2026-10-20T00:00:00Z',
  };
  const event = (id: number, fields: Partial<PublicEventDetail>): PublicEventDetail => ({ ...base, id, ...fields });
  const events = [
    base,
    event(2, { startAt: '2026-10-24T06:30:00Z', category: 'ai' }),
    event(3, { startAt: '2026-10-25T06:30:00Z', category: 'finance', priceType: 'paid', priceNote: '₹500' }),
    event(4, { startAt: '2026-10-28T06:30:00Z' }),
    event(5, { startAt: null, priceType: null }),
    event(6, { startAt: '2026-10-20T06:30:00Z' }),
    event(7, { startAt: '2026-10-21T01:00:00Z', endAt: '2026-10-21T02:00:00Z' }),
    event(8, { startAt: '2026-10-22T06:30:00Z', status: 'expired' }),
  ];
  const ids = (key: string, date = now) => eventsForCollection(events, getEventCollection(key)!, date).map(e => e.id);
  assert.deepEqual(ids('this-week'), [1, 2, 3]);
  assert.deepEqual(ids('today'), [1]);
  assert.deepEqual(ids('this-weekend'), [2, 3]);
  assert.deepEqual(ids('tech-this-week'), [1, 2]);
  assert.deepEqual(ids('finance-this-week'), [3]);
  assert.deepEqual(ids('free'), [1, 2, 4]);
  assert.equal(getEventCollection('unknown'), undefined);
  assert.equal(getEventCollection('this-week?category=finance'), undefined);

  const sunday = new Date('2026-10-25T04:30:00Z');
  const sundayEvents = [
    event(10, { startAt: '2026-10-25T12:30:00Z' }),
    event(11, { startAt: '2026-10-31T12:30:00Z' }),
  ];
  assert.deepEqual(eventsForCollection(sundayEvents, getEventCollection('this-weekend')!, sunday).map(e => e.id), [10], 'Sunday must not include next Saturday');
  assert.deepEqual(eventsForCollection(sundayEvents, getEventCollection('this-week')!, sunday).map(e => e.id), [10, 11], 'This week uses the same rolling seven days as the existing feed');
  const midnightIst = new Date('2026-10-21T18:35:00Z');
  assert.deepEqual(eventsForCollection([event(12, { startAt: '2026-10-21T18:40:00Z' })], getEventCollection('today')!, midnightIst).map(e => e.id), [12], 'IST midnight is independent of server timezone');
  const yearEnd = new Date('2026-12-31T18:40:00Z');
  assert.match(eventCollectionDateNote(getEventCollection('this-week')!, yearEnd), /1 Jan 2027.*7 Jan 2027/);

  for (const collection of EVENT_COLLECTIONS) {
    const matching = eventsForCollection(events, collection, now);
    const metadata = await generateMetadata({ params: Promise.resolve({ collection: collection.key }) });
    assert.equal(metadata.alternates?.canonical, eventCollectionPath(collection));
    assert.match(metadata.title as string, /Chennai/);
    assert.ok(metadata.description && metadata.description.length <= 160);
    const schema = eventCollectionStructuredData(collection, matching);
    assert.equal(schema['@type'], 'CollectionPage');
    const list = schema.mainEntity as { numberOfItems: number; itemListElement: { position: number; url: string }[] };
    assert.equal(list.numberOfItems, matching.length);
    assert.deepEqual(list.itemListElement.map(item => item.position), matching.map((_, index) => index + 1));
    assert.ok(list.itemListElement.every(item => item.url.startsWith('https://scene044.in/events/')));
    const $ = load(renderToStaticMarkup(createElement(EventCollectionView, {
      collection, events: matching, dateNote: eventCollectionDateNote(collection, now),
    })));
    assert.equal($('h1').text(), collection.title);
    assert.equal($('h1').length, 1);
    assert.equal($('article').length, matching.length, 'actual server-rendered cards match collection schema');
    assert.equal($('article').first().attr('class'), matching.length ? 'scene-card scene-rise group relative min-w-0' : undefined, 'existing ticket card styling stays unchanged');
    assert.equal($('nav[aria-label="Find events in Chennai"] a').length, EVENT_COLLECTIONS.length, 'all discovery destinations are crawlable');
    assert.equal($('a[href="/category/finance"]').length, 1);
  }
  const empty = load(renderToStaticMarkup(createElement(EventCollectionView, {
    collection: getEventCollection('finance-this-week')!, events: [], dateNote: '',
  })));
  assert.match(empty('main').text(), /No finance events this week listed right now/);
  assert.equal(empty('article').length, 0, 'no unrelated filler events in an empty collection');
  assert.deepEqual((await generateMetadata({ params: Promise.resolve({ collection: 'bogus' }) })).robots, { index: false, follow: false });
  await assert.rejects(EventCollectionPage({ params: Promise.resolve({ collection: 'bogus' }) }), /NEXT_HTTP_ERROR_FALLBACK;404/);
  await assert.rejects(CategoryPage({ params: Promise.resolve({ key: 'finance,ai,finance' }) }), /NEXT_REDIRECT/);
  assert.deepEqual((await categoryMetadata({ params: Promise.resolve({ key: 'ai,finance' }) })).robots, { index: false, follow: true });

  const previousPool = globalThis.__pgPool;
  try {
    globalThis.__pgPool = { query: async (sql: string) => {
      assert.match(sql, /^\s*SELECT\b/i, 'SEO requests must be read-only');
      return { rows: sql.includes('FROM events e') ? [{ ...base, startAt: '2099-10-21T12:30:00Z' }] : [] };
    } } as unknown as Pool;
    const page = await EventCollectionPage({ params: Promise.resolve({ collection: 'free' }) });
    const $ = load(renderToStaticMarkup(page));
    const renderedSchema = JSON.parse($('script[type="application/ld+json"]').first().text());
    assert.equal(renderedSchema.mainEntity.numberOfItems, 1);
    assert.equal($('article').length, 1);
    const entries = await sitemap();
    for (const collection of EVENT_COLLECTIONS) {
      assert.equal(entries.filter(entry => entry.url === `https://scene044.in${eventCollectionPath(collection)}`).length, 1);
    }
    assert.equal(entries.some(entry => entry.url.includes('/category/ai,finance')), false);
    const encodedCategory = await CategoryPage({ params: Promise.resolve({ key: 'ai%2Cfinance' }) });
    assert.ok(encodedCategory, 'encoded commas must not cause a canonical redirect loop');
    globalThis.__pgPool = { query: async () => { throw new Error('Fixture database outage'); } } as unknown as Pool;
    await assert.rejects(EventCollectionPage({ params: Promise.resolve({ collection: 'free' }) }), /Fixture database outage/, 'an outage cannot become an indexable empty 200 page');
  } finally { globalThis.__pgPool = previousPool; }

  assert.match(categorySeoHeading(FIELD_CARDS.find(card => card.key === 'tech')!), /Tech & Developer Events in Chennai/);
  assert.match(eventSeoTitle({ ...base, isOnline: true }), /Online event/);
  assert.equal(eventStructuredData({ ...base, startAt: 'not-a-date' }), null);
  assert.equal((eventStructuredData(base)?.offers as Record<string, unknown>).availability, undefined, 'never invent ticket availability');
  assert.equal(eventStructuredData({ ...base, posterImageUrl: null })?.image, undefined, 'stock photo is not labelled as an official event image');
  assert.equal(eventStructuredData({ ...base, endAt: '2026-10-20T00:00:00Z' })?.endDate, undefined);
  assert.equal((homeEventStructuredData([base]).mainEntity as { numberOfItems: number }).numberOfItems, 1);
  console.log('PASS event discovery: six metadata/routes, crawlable SSR cards and navigation, honest empty states, category/price/date filtering, IST boundaries, Sunday/year rollover and factual Event schema');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
