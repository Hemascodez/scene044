import type { PublicEvent } from './events';
import { eventAddressRegion, normalizeEventCity } from './eventLocations';
import { effectiveEndAt, eventDateRangeNeedsReview } from './eventDates';

export type CityHubEvent = PublicEvent & { updatedAt?: string; venueAddress?: string | null };
export type CityHub = { city: string; slug: string };

// A small set of supported destinations, not a directory of keyword pages.
const CORE_CITIES = ['Chennai', 'Bengaluru', 'Mumbai', 'Delhi', 'Gurugram', 'Kochi', 'Thiruvananthapuram', 'Tiruchirappalli'];

export function cityHubCity(value: unknown): string | null {
  const city = normalizeEventCity(value);
  return city === 'New Delhi' ? 'Delhi' : city;
}

function citySlug(city: string): string {
  return city.toLowerCase().replace(/\s+/g, '-');
}

export function cityHubPath(hub: CityHub): string {
  return `/events/city/${hub.slug}`;
}

/** Kerala destinations come from published event locations. A state name,
 * event title or discovery/search hint can never supply a city. */
export function supportedCityHubs(events: readonly CityHubEvent[]): CityHub[] {
  const cities = new Set(CORE_CITIES);
  for (const event of events) {
    if (event.isOnline) continue;
    const city = cityHubCity(event.city);
    if (!city) continue;
    if (eventAddressRegion(city) === 'Kerala'
      || /(?:^|[,;\n])\s*Kerala(?:\s+\d{6})?\s*(?:[,;\n]|$)/i.test(event.venueAddress ?? '')) cities.add(city);
  }
  return [...cities].sort((a, b) => a.localeCompare(b, 'en-IN')).map(city => ({ city, slug: citySlug(city) }));
}

export function getCityHub(slug: string, events: readonly CityHubEvent[]): CityHub | null {
  if (!/^[a-zA-Z]+(?:-[a-zA-Z]+)*$/.test(slug) || slug.length > 80) return null;
  const city = cityHubCity(slug.replace(/-/g, ' '));
  return supportedCityHubs(events).find(hub => hub.city === city) ?? null;
}

export function cityHubForEvent(event: CityHubEvent): CityHub | null {
  if (event.isOnline) return null;
  return supportedCityHubs([event]).find(hub => hub.city === cityHubCity(event.city)) ?? null;
}

/** Stricter than the general feed: no grace period, missing dates, postponed
 * dates or online events assigned to a city. Ongoing events remain useful. */
export function eventsForCityHub(events: readonly CityHubEvent[], hub: CityHub, now = new Date()): CityHubEvent[] {
  const seen = new Set<number>();
  return events.filter(event => {
    if (seen.has(event.id) || event.isOnline || !['live', 'updated'].includes(event.status)
      || cityHubCity(event.city) !== hub.city || !event.title.trim()
      || !event.startAt || !Number.isFinite(Date.parse(event.startAt))) return false;
    if (event.endAt && (!Number.isFinite(Date.parse(event.endAt)) || eventDateRangeNeedsReview(event.startAt, event.endAt))) return false;
    if ((effectiveEndAt(event.startAt, event.endAt) ?? 0) <= now.getTime()) return false;
    seen.add(event.id);
    return true;
  }).sort((a, b) => Date.parse(a.startAt!) - Date.parse(b.startAt!) || a.id - b.id);
}

export function activeCityHubs(events: readonly CityHubEvent[], now = new Date()) {
  return supportedCityHubs(events).flatMap(hub => {
    const listings = eventsForCityHub(events, hub, now);
    return listings.length ? [{ ...hub, count: listings.length }] : [];
  });
}

/** Only persisted content modification times; verification/request time is
 * deliberately not a lastmod. Omit if no trustworthy timestamp is available. */
export function cityHubLastModified(events: readonly CityHubEvent[], now = new Date()): Date | undefined {
  const times = events.map(event => Date.parse(event.updatedAt ?? ''))
    .filter(time => Number.isFinite(time) && time <= now.getTime());
  return times.length ? new Date(Math.max(...times)) : undefined;
}
