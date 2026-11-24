/** A bounded, operator-requested catch-up through the normal curator API.
 * Dry-run by default; never opens the private database or changes source trust.
 * Usage: railway run --no-local ... -- node --import tsx scripts/import-city-events.ts
 *   --city Mumbai --url https://luma.com/example [--url ...] [--publish]
 */
import { fetchEventPage } from '../lib/eventPageFetch';
import { extractEventDocument, validateExtractedEvent } from '../lib/extract';
import { automaticPublicationIssue, publicationLimit } from '../lib/eventIngestionQuality';
import { eventCityError, normalizeEventCity } from '../lib/eventLocations';
import { isPastEvent } from '../lib/eventDates';
import { categorizeEvent } from '../lib/categorize';
import { summarizeEvent } from '../lib/summarize';

const values = (name: string) => process.argv.flatMap((v, i) => v === `--${name}` ? [process.argv[i + 1]] : []).filter(Boolean);
const publish = process.argv.includes('--publish');
const cities = values('city').map(normalizeEventCity);
const urls = [...new Set(values('url'))];
const base = 'https://scene044.in';

async function api(path: string, body: object): Promise<Record<string, unknown>> {
  if (!process.env.CURATOR_PASSWORD) throw new Error('Curator credential is not configured');
  const response = await fetch(`${base}/api/admin/curator/${path}`, {
    method: 'POST', headers: {
      Authorization: `Basic ${Buffer.from(`curator:${process.env.CURATOR_PASSWORD}`).toString('base64')}`,
      'Content-Type': 'application/json',
    }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`${path} refused (${response.status})`);
  return result;
}

async function main() {
  if (!cities.length || cities.some(city => !city) || !urls.length || urls.length > 10) {
    throw new Error('Pass explicit --city and 1–10 --url values');
  }
  if (publish && urls.length > publicationLimit()) throw new Error('Requested URLs exceed the configured publication safety limit');
  for (const input of urls) {
    const u = new URL(input);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search
      || !['luma.com', 'lu.ma', 'www.meetup.com', 'meetup.com', 'kynhood.com'].includes(u.hostname)) {
      throw new Error('Use canonical public source URLs without queries or credentials');
    }
  }
  for (const url of urls) {
    const fetched = await fetchEventPage(url, ['luma.com', 'lu.ma', 'meetup.com', 'kynhood.com']);
    if (!fetched.ok) { console.log(JSON.stringify({ url, skipped: fetched.reason })); continue; }
    const outcome = await extractEventDocument(fetched.text, fetched.finalUrl, null);
    if (outcome.kind !== 'event') { console.log(JSON.stringify({ url, skipped: outcome.kind })); continue; }
    const event = outcome.event;
    const issue = automaticPublicationIssue(event, outcome.supportingText)
      || eventCityError(event)
      || (event.isOnline || !cities.includes(normalizeEventCity(event.city)) ? 'outside_requested_cities' : null)
      || (isPastEvent(event.startAt, event.endAt) ? 'past_event' : null);
    const validation = validateExtractedEvent(event);
    if (issue || !validation.valid) { console.log(JSON.stringify({ url, city: event.city, skipped: issue ?? validation })); continue; }
    const category = await categorizeEvent({ ...event });
    if (!category.category || category.classificationError) { console.log(JSON.stringify({ url, skipped: 'classification_needs_review' })); continue; }
    const editorial = await summarizeEvent({ ...event, category: category.category,
      rawSummary: event.summary, supportingText: outcome.supportingText });
    if (editorial.generationStatus !== 'generated' || !editorial.eventIntro) {
      console.log(JSON.stringify({ url, skipped: 'editorial_needs_review' })); continue;
    }
    const draft = { title: event.title, summary: editorial.eventIntro, gist: editorial.gist,
      highlights: editorial.whyAttend, category: category.category,
      startAt: event.startAt, endAt: event.endAt, isOnline: false,
      venueName: event.venueName, venueAddress: event.venueAddress, city: event.city,
      organizerName: event.organizerName, posterImageUrl: event.posterImageUrl,
      priceType: event.priceType, priceNote: event.priceNote, chennaiRelevanceScore: 0,
      primarySourceUrl: url, status: 'live' };
    if (!publish) { console.log(JSON.stringify({ url, dryRun: true, draft })); continue; }
    const target = await api('add', { url });
    if (target.destination === 'event') {
      console.log(JSON.stringify({ url, existingEventId: target.eventId })); continue;
    }
    const item = target.item as { status?: string; rejection_reason?: string; origin?: string } | undefined;
    if (!item || !['curator_pending', 'new', 'auto_processing'].includes(item.status ?? '')
      || (item.origin === 'curator' && target.reused)) {
      console.log(JSON.stringify({ url, skipped: 'existing_curator_decision', status: item?.status })); continue;
    }
    // Explicitly taking this one candidate for curation fences an extraction
    // lease. Never reopen a rejected, correction, date-review or expired item.
    if (item.status !== 'curator_pending') await api('item-status', {
      discoveryItemId: target.discoveryItemId, action: 'reopen', expectedStatus: item.status,
      reason: 'Operator-requested city catch-up',
    });
    if (event.posterImageUrl) {
      try { const poster = await api('poster', { url: event.posterImageUrl });
        draft.posterImageUrl = typeof poster.url === 'string' ? poster.url : null;
      } catch { draft.posterImageUrl = null; }
    }
    const saved = await api('approve', { ...draft, discoveryItemId: target.discoveryItemId });
    console.log(JSON.stringify({ url, city: event.city, title: event.title, startAt: event.startAt,
      status: saved.status, eventId: saved.eventId }));
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'City import failed'); process.exitCode = 1; });
