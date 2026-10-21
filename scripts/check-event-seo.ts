/** Read-only HTTP smoke check. Run after a build or deployment:
 * node --import tsx scripts/check-event-seo.ts --base=http://127.0.0.1:3012
 */
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { EVENT_COLLECTIONS, eventCollectionPath } from '../lib/eventDiscovery';
import { absoluteUrl } from '../lib/seo';

async function main() {
  const base = new URL(process.argv.find(arg => arg.startsWith('--base='))?.slice(7) ?? 'http://localhost:3004');
  const sitemapResponse = await fetch(new URL('/sitemap.xml', base));
  assert.equal(sitemapResponse.status, 200);
  const xml = await sitemapResponse.text();
  assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|apos;)/);
  const sitemap = load(xml, { xmlMode: true });
  const urls = sitemap('url > loc').map((_, node) => sitemap(node).text()).get();
  for (const collection of EVENT_COLLECTIONS) {
    const path = eventCollectionPath(collection);
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200, path);
    const $ = load(await response.text());
    assert.equal($('link[rel="canonical"]').attr('href'), absoluteUrl(path));
    assert.equal($('h1').text(), collection.title);
    assert.equal($('h1').length, 1);
    assert.ok($('meta[name="description"]').attr('content'));
    const schema = $('script[type="application/ld+json"]').toArray().map(node => JSON.parse($(node).text())).find(data => data['@type'] === 'CollectionPage');
    assert.ok(schema, path);
    assert.equal(schema.mainEntity.numberOfItems, $('main article').length, `${path}: visible cards and markup must agree`);
    assert.equal($('nav[aria-label="Find events in Chennai"] a').length, EVENT_COLLECTIONS.length);
    assert.ok(urls.includes(absoluteUrl(path)), `${path}: missing sitemap entry`);
    console.log(`PASS ${path}: 200, unique heading/canonical, ${schema.mainEntity.numberOfItems} SSR event cards, matching schema and sitemap`);
  }
  const invalid = await fetch(new URL('/events/chennai/not-a-real-collection', base));
  assert.equal(invalid.status, 404);
  const duplicate = await fetch(new URL('/category/finance,ai,finance', base), { redirect: 'manual' });
  assert.equal(duplicate.status, 308);
  assert.ok(duplicate.headers.get('location')?.endsWith('/category/ai,finance'));
  const combined = await fetch(new URL('/category/ai,finance', base));
  const $ = load(await combined.text());
  assert.match($('meta[name="robots"]').attr('content') ?? '', /noindex/);
  console.log('PASS unknown collection 404, duplicate category 308, combined filter noindex and XML escaping');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
