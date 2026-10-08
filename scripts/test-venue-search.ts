import assert from 'node:assert/strict';
import { TIME_CAFE } from '../lib/venues';
import { matchingSpaces, requestedCapacity, venueDetailSearchHref, venueSearchValues, readVenueSearchPreferences, saveVenueSearchPreferences } from '../lib/venueSearch';
import { chandruReviews, publishedVenueReviews, CHANDRU_TESTIMONIAL } from '../lib/venueTestimonials';
import type { VenueReview } from '../lib/venueBookings';

assert.equal(matchingSpaces(TIME_CAFE.spaces, '50').length, 0);
assert.deepEqual(matchingSpaces(TIME_CAFE.spaces, '25').map(s => s.id), ['first-floor']);
assert.equal(matchingSpaces(TIME_CAFE.spaces, '4').length, 4);
assert.equal(matchingSpaces(TIME_CAFE.spaces, '').length, 4);
for (const people of ['0', '-1', '3.5', 'NaN', 'Infinity', 'abc']) {
  assert.ok(Number.isNaN(requestedCapacity(people)));
  assert.equal(matchingSpaces(TIME_CAFE.spaces, people).length, 0);
}
const values = venueSearchValues({ location: 'Nungambakkam, Chennai', date: '2026-10-20', time: '18:30', people: '25', eventType: 'Workshop' });
const url = new URL(venueDetailSearchHref('time-cafe', values, 'first-floor'), 'http://localhost');
assert.equal(url.pathname, '/venues/time-cafe');
assert.equal(url.searchParams.get('spaceId'), 'first-floor');
for (const [key, value] of Object.entries(values)) assert.equal(url.searchParams.get(key), value);
assert.equal(url.hash, '', 'view details must not jump into a booking form');
assert.equal(venueSearchValues({ eventType: 'invalid' }).eventType, 'Tech meetup');
assert.equal(venueSearchValues({ people: ['50', '4'] }).people, '50');
assert.deepEqual(readVenueSearchPreferences(), {}, 'SSR/storage failure is safe');
saveVenueSearchPreferences(values); // SSR must not throw when storage is absent.

const base: VenueReview = { id: 1, bookingId: null, venueSlug: 'time-cafe', rating: 5, tags: [], comment: 'Fixture', photoIds: [], photoConsent: false, source: 'self_reported', status: 'published', createdAt: '2026-10-07T00:00:00Z' };
assert.deepEqual(chandruReviews([
  { ...base, organizerName: 'Chandru' }, { ...base, id: 2, organizerName: 'AI sample' },
  { ...base, id: 3, organizerName: 'Chandru', status: 'pending' },
]).map(r => r.id), [1]);
assert.equal(CHANDRU_TESTIMONIAL.name, 'Chandru');
assert.deepEqual(publishedVenueReviews([
  { ...base, organizerName: 'New real organiser' },
  { ...base, id: 2, organizerName: 'Awaiting approval', status: 'pending' },
  { ...base, id: 3, organizerName: 'Rejected sample', status: 'rejected' },
]).map(review => review.id), [1], 'approved new reviewers are visible; pending and rejected records are not');
assert.equal(CHANDRU_TESTIMONIAL.profilePhoto, '/venues/figma/0e739.jpg');
assert.deepEqual(CHANDRU_TESTIMONIAL.eventPhotos.map(photo => photo.src), ['/venues/figma/2010d.jpg']);
assert.ok(!('rating' in CHANDRU_TESTIMONIAL), 'do not invent aggregate or booking ratings');
console.log('PASS: capacity filtering, individual-space links, search handoff, invalid filters, storage fallbacks and genuine-review selection.');
