import type { PublicEvent } from './events';
import { getISTParts } from './client/istTime';
import { normalizeEventCity } from './eventLocations';

export type EventSeoIssue = {
  code: string;
  severity: 'error' | 'review';
  message: string;
};

/** A review queue, not a ranking score or permission to rewrite event facts.
 * Inputs are published listing facts; no model, private data or database write. */
export function reviewEventSeo(event: PublicEvent & { venueAddress?: string | null }): EventSeoIssue[] {
  const issues: EventSeoIssue[] = [];
  const add = (code: string, message: string, severity: EventSeoIssue['severity'] = 'review') =>
    issues.push({ code, severity, message });
  if (!event.title.trim()) add('missing_title', 'Add the official event title.', 'error');
  const start = event.startAt ? Date.parse(event.startAt) : NaN;
  const end = event.endAt ? Date.parse(event.endAt) : NaN;
  if (!Number.isFinite(start)) add('missing_start', 'Confirm the event date and time before emitting Event markup.', 'error');
  if (event.endAt && (!Number.isFinite(end) || end <= start)) add('invalid_end', 'Confirm that the end is after the start.', 'error');
  const city = normalizeEventCity(event.city);
  if (!event.isOnline && !city) add('missing_city', 'Confirm the city; never default an unknown location to Chennai.', 'error');
  const venue = event.venueName?.trim();
  if (!event.isOnline && (!venue || /^(?:register to|tba\b|tbd\b|to be announced)/i.test(venue)
    || normalizeEventCity(venue.split(',')[0]) === city)) {
    add('withheld_venue', 'The physical venue is missing or withheld. Ask the host; do not invent a venue for rich results.');
  }
  if (!event.isOnline && 'venueAddress' in event && !event.venueAddress?.trim()) {
    add('missing_address', 'Obtain the published venue address for physical Event markup.');
  }
  if (!event.organizerName) add('missing_organizer', 'Add the organizer from the official source.');
  if (!event.posterImageUrl) add('missing_poster', 'Add an official poster; do not mark a stock image as event artwork.');
  if (!event.summary?.trim() && !event.highlights.length) add('missing_description', 'Add a source-backed description or highlights.');
  if (event.priceType === null) add('unknown_price', 'Confirm whether entry is free or paid; unknown must not be advertised as free.');
  if (event.priceType === 'paid' && !event.hostedPricePaise) add('check_paid_offer', 'Check the published currency, ticket tiers and fees before adding a structured price.');

  if (Number.isFinite(start) && Number.isFinite(end)) {
    const from = getISTParts(new Date(start));
    const to = getISTParts(new Date(end));
    const sameDay = from.year === to.year && from.month === to.month && from.day === to.day;
    if (sameDay && from.hour < 12 && to.hour <= 13 && /\bafternoon\b/i.test(event.summary ?? '')) {
      add('daypart_conflict', 'The IST schedule starts in the morning, but the copy says afternoon. Review the wording.');
    }
    if (from.hour === 5 && from.minute === 30 && to.hour === 5 && to.minute === 30) {
      add('possible_date_only_time', 'Both times are midnight UTC / 5:30am IST. Verify whether the source supplied dates only.');
    }
  }
  return issues;
}
