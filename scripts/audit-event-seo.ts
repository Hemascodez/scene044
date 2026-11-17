/** Bounded, read-only SEO check for newly published events. No credentials,
 * provider calls, database writes, indexing requests or deployment actions.
 * npm run seo:events -- --since=2026-11-17
 * npm run seo:events -- --ids=185,186 --base=http://127.0.0.1:3017
 */
import { load } from 'cheerio';
import type { PublicEvent } from '../lib/events';
import { eventPath, absoluteUrl } from '../lib/seo';
import { reviewEventSeo } from '../lib/eventSeoQuality';

async function main() {
  const options = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--(base|since|ids)=(.+)$/);
    if (!match || options.has(match[1])) throw new Error('Use --since=YYYY-MM-DD or --ids=185,186; optional --base=URL.');
    options.set(match[1], match[2]);
  }
  const base = new URL(options.get('base') ?? 'https://scene044.in');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.username || base.password || base.pathname !== '/' || base.search || base.hash
    || (!local && base.origin !== 'https://scene044.in')
    || (local && !['http:', 'https:'].includes(base.protocol))) {
    throw new Error('Only the public Scene origin or an explicit local test server is allowed.');
  }
  if (options.has('since') && options.has('ids')) throw new Error('Choose --since or --ids, not both.');
  const since = options.get('since');
  if (since && (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !Number.isFinite(Date.parse(since))
    || new Date(since).toISOString().slice(0, 10) !== since)) throw new Error('Invalid --since date.');
  const rawIds = options.get('ids');
  if (rawIds && !/^[1-9]\d*(?:,[1-9]\d*)*$/.test(rawIds)) throw new Error('Invalid event IDs.');
  const ids = rawIds ? [...new Set(rawIds.split(',').map(Number))] : null;
  if (ids && (ids.length > 30 || ids.some(id => !Number.isSafeInteger(id)))) throw new Error('Choose at most 30 valid event IDs.');

  async function read(path: string) {
    // Paths are built locally from fixed routes and id-backed slugs. Never
    // crawl third-party source/image URLs or follow external redirects.
    const response = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    if (response.status === 429) throw new Error('Rate limited; stopped without retrying.');
    if (response.status !== 200) throw new Error(`Public request returned HTTP ${response.status}: ${path}`);
    return { response, text: await response.text() };
  }
  const feed = await read('/api/events');
  const payload = JSON.parse(feed.text) as { events: PublicEvent[] };
  if (!Array.isArray(payload.events)) throw new Error('Public event feed unavailable.');
  const selected = payload.events.filter(event => ids ? ids.includes(event.id)
    : since ? Date.parse(event.discoveredAt) >= Date.parse(`${since}T00:00:00+05:30`) : true)
    .sort((a, b) => Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt)).slice(0, 30);
  if (!selected.length) throw new Error('No published events match this selection.');
  if (ids?.some(id => !selected.some(event => event.id === id))) throw new Error('One or more selected IDs are not in the public upcoming feed.');
  const sitemap = load((await read('/sitemap.xml')).text, { xmlMode: true });
  const listed = new Set(sitemap('url > loc').map((_, el) => sitemap(el).text()).get());
  const rows = [];
  for (const event of selected) {
    const path = eventPath(event);
    const { response, text } = await read(path);
    const $ = load(text);
    const errors: string[] = [];
    const schema: Record<string, unknown>[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try { schema.push(JSON.parse($(el).text())); } catch { errors.push('Invalid JSON-LD.'); }
    });
    const eventSchema = schema.find(item => item?.['@type'] === 'Event');
    const title = $('title').text();
    const description = $('meta[name="description"]').attr('content');
    const canonical = $('link[rel="canonical"]').attr('href');
    if (!title) errors.push('Missing title.');
    if (!description) errors.push('Missing meta description.');
    if ($('h1').length !== 1 || $('h1').text().trim() !== event.title.trim()) errors.push('H1 does not match the published title.');
    if (canonical !== absoluteUrl(path)) errors.push('Canonical does not match the public URL.');
    if (!listed.has(absoluteUrl(path))) errors.push('Missing from sitemap.');
    if (/noindex|none/i.test(`${$('meta[name="robots"]').attr('content') ?? ''} ${response.headers.get('x-robots-tag') ?? ''}`)) errors.push('Page is noindex.');
    if (event.startAt && !eventSchema) errors.push('Dated event is missing Event markup.');
    if (eventSchema && (eventSchema.name !== event.title || eventSchema.url !== absoluteUrl(path)
      || Date.parse(String(eventSchema.startDate)) !== Date.parse(event.startAt ?? ''))) errors.push('Event markup differs from published facts.');
    const location = eventSchema?.location as { address?: { streetAddress?: string } } | undefined;
    rows.push({ id: event.id, title: event.title, url: absoluteUrl(path), city: event.city,
      metadata: { title, description }, errors,
      review: reviewEventSeo({ ...event, venueAddress: location?.address?.streetAddress ?? null }),
    });
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base: base.origin,
    selected: rows.length, limit: 30, readOnly: true,
    limitedSelection: !ids && payload.events.filter(event => !since || Date.parse(event.discoveredAt) >= Date.parse(`${since}T00:00:00+05:30`)).length > 30,
    technicalErrors: rows.reduce((sum, row) => sum + row.errors.length, 0),
    needsReview: rows.filter(row => row.review.length).length, rows,
    notMeasured: ['Google indexing/rankings', 'Rich Results Test eligibility', 'live source availability', 'Core Web Vitals'],
  }, null, 2));
  if (rows.some(row => row.errors.length || row.review.some(issue => issue.severity === 'error'))) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Public SEO check failed.'); process.exitCode = 1; });
