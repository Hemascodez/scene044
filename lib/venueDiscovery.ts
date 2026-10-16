import type { CatalogVenue } from './venueCatalog';
import { isWeekdaysOnlyVenue } from './venueAvailability';

/** Editorial search intent, not a keyword-volume estimate or an availability
 * promise. Names, locations, capacity, photos and rates remain catalog-owned. */
const SEARCH_INTENTS: Record<string, { title: string; uses: string }> = {
  'time-cafe': {
    title: 'Workshop & Meetup Venue',
    uses: 'workshops, tech meetups and small professional gatherings',
  },
  'chennai-yoga-studio': {
    title: 'Art & Dance Studio',
    uses: 'art workshops, dance rehearsals, yoga and wellness sessions',
  },
  'the-freshlymade-resto-cafe': {
    title: 'Weekday Meeting Space',
    uses: 'weekday meetings and small workshops',
  },
};

export const VENUES_SEARCH_TITLE = 'Workshop & Small Event Venues in Chennai | SCENE/044';
export const VENUES_SEARCH_DESCRIPTION =
  'Find workshop venues, meetup spaces and art, dance and wellness studios in Chennai. Compare photos, capacity and rates. Pay after host approval.';

export function venueSearchIntent(venue: Pick<CatalogVenue, 'slug'>) {
  return Object.hasOwn(SEARCH_INTENTS, venue.slug) ? SEARCH_INTENTS[venue.slug] : undefined;
}

/** Visible copy in the existing introduction; no hidden keyword blocks. */
export function venueBookingIntroduction(venue: CatalogVenue): string {
  const intent = venueSearchIntent(venue);
  const introduction = intent
    ? `Find space for ${intent.uses} at ${venue.name} in ${venue.area}, ${venue.city}.`
    : `Explore the spaces at ${venue.name} in ${venue.area}, ${venue.city}.`;
  return `${introduction} Send a booking request; pay only after host approval. A request is not a confirmed booking.`;
}

/** Keep the operating restriction ahead of optional snippet details. */
export function venueSearchDescription(venue: CatalogVenue): string {
  const intent = venueSearchIntent(venue);
  const maxGuests = Math.max(0, ...venue.spaces.map(space => space.maxGuests));
  const availability = isWeekdaysOnlyVenue(venue.slug) ? 'Monday–Friday only. ' : '';
  return `${availability}${venue.name} in ${venue.area}, ${venue.city}.${maxGuests ? ` Up to ${maxGuests} guests.` : ''}${intent ? ` For ${intent.uses}.` : ''} View photos and rates.`;
}

export function venuePhotoAlt(venue: Pick<CatalogVenue, 'name' | 'area' | 'city'>, index: number): string {
  return `${venue.name}, ${venue.area}, ${venue.city} — venue photo ${index + 1}`;
}
