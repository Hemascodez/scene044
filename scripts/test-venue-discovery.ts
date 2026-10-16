import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { load } from 'cheerio';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CatalogVenue } from '../lib/venueCatalog';
import { TIME_CAFE } from '../lib/venues';
import { publicSpacePricing } from '../lib/venuePricing';
import {
  venueBookingIntroduction, venuePhotoAlt,
  VENUES_SEARCH_DESCRIPTION, VENUES_SEARCH_TITLE,
} from '../lib/venueDiscovery';
import {
  serializeJsonLd, venueCollectionStructuredData, venueSeoDescription,
  venueSeoTitle, venueStructuredData,
} from '../lib/seo';
import { VenueIndex } from '../components/venues/figma/VenueIndex';

const time: CatalogVenue = {
  ...TIME_CAFE, id: 1, status: 'live', rating: null, ratingCount: null, ratingUrl: null,
  photos: [...TIME_CAFE.photos], amenities: [...TIME_CAFE.amenities], policies: [...TIME_CAFE.policies],
  spaces: TIME_CAFE.spaces.map((space, index) => ({ ...space, rowId: index + 1, sortOrder: index })),
};
const yoga: CatalogVenue = {
  ...time, id: 2, slug: 'chennai-yoga-studio', name: 'Chennai Yoga Studio', area: 'Kilpauk',
  summary: 'A naturally lit studio for art workshops, dance rehearsals, yoga and wellness sessions.',
  amenities: ['Air conditioning', 'Wi-Fi', 'Bluetooth music system'],
  spaces: [{ ...time.spaces[0], name: 'Yoga & Wellness Studio', maxGuests: 25, communityRate: 2000,
    pricing: publicSpacePricing(2000, { minHours: 2, markupBasisPoints: 1000, packages: [
      { id: 'half-day', name: 'Half-day', hours: 4, basePrice: 7000 },
      { id: 'full-day', name: 'Full-day', hours: 8, basePrice: 12000 },
    ] }),
  }],
};
const fresh: CatalogVenue = {
  ...time, id: 3, slug: 'the-freshlymade-resto-cafe', name: 'The FreshlyMade - Resto Cafe', area: 'RA Puram',
  summary: 'A neighbourhood cafe for small gatherings.',
  spaces: [{ ...time.spaces[0], name: 'Whole Space', maxGuests: 20, communityRate: 1000 }],
};
const venues = [time, yoga, fresh];
const original = JSON.stringify(venues);
for (const venue of venues) {
  const title = venueSeoTitle(venue);
  const description = venueSeoDescription(venue);
  const introduction = venueBookingIntroduction(venue);
  assert.ok(title.includes(venue.name) && title.includes(venue.area) && title.includes(venue.city));
  assert.ok(description.length <= 160);
  assert.ok(description.includes(`${Math.max(...venue.spaces.map(s => s.maxGuests))} guests`));
  assert.ok(introduction.includes(venue.name) && introduction.includes(venue.area));
  assert.match(introduction, /pay only after host approval/i);
  assert.match(introduction, /not a confirmed booking/);
  assert.equal(venueStructuredData(venue).description, description);
  assert.equal(venueStructuredData(venue).aggregateRating, undefined);
  console.log(`${venue.slug}: ${title}\n  ${description}`);
}
assert.match(venueSeoTitle(time), /Workshop & Meetup/);
assert.match(venueSeoDescription(time), /workshops, tech meetups/);
assert.match(venueSeoTitle(yoga), /Art & Dance/);
assert.match(venueSeoDescription(yoga), /art workshops, dance rehearsals/);
assert.doesNotMatch(venueBookingIntroduction(yoga), /podcast|party|product launch|tech meetup|wedding/i);
assert.match(venueSeoDescription(fresh), /^Monday–Friday only\./);
assert.match(venueBookingIntroduction(fresh), /weekday meetings/);
assert.equal(venueSeoDescription({ ...yoga, spaces: [] }).includes('guests'), false);
assert.ok(venueSeoDescription({ ...time, spaces: [{ ...time.spaces[0], maxGuests: 12 }] }).includes('12 guests'));
assert.ok(venueSeoTitle({ ...time, name: 'Updated Venue', area: 'Updated Area', city: 'Updated City' }).includes('Updated Area, Updated City'));
assert.equal(venuePhotoAlt(fresh, 1), 'The FreshlyMade - Resto Cafe, RA Puram, Chennai — venue photo 2');
for (const slug of ['future-venue', 'toString', '__proto__']) {
  const other = { ...time, slug, name: 'New Venue', area: 'Adyar', city: 'Chennai' };
  assert.match(venueSeoTitle(other), /Event Space in Adyar, Chennai/);
  assert.doesNotMatch(venueBookingIntroduction(other), /workshop|weekday|yoga/);
}
assert.equal(JSON.stringify(venues), original, 'SEO never changes catalog rates, packages, photos or capacity');
assert.equal(yoga.spaces[0].pricing?.hourlyRate, 2200);
assert.equal(yoga.spaces[0].pricing?.packages[0].price, 7700);
assert.equal(yoga.spaces[0].pricing?.packages[1].price, 13200);

const collection = venueCollectionStructuredData([
  ...venues, { ...time, slug: 'draft', status: 'hidden' }, { ...time, slug: 'soon', status: 'coming-soon' },
]);
const list = collection.mainEntity as { numberOfItems: number; itemListElement: { position: number; url: string }[] };
assert.equal(list.numberOfItems, 3);
assert.deepEqual(list.itemListElement.map(item => item.url), venues.map(v => `https://scene044.in/venues/${v.slug}`));
assert.deepEqual(list.itemListElement.map(item => item.position), [1, 2, 3]);
assert.equal((venueCollectionStructuredData([]).mainEntity as { numberOfItems: number }).numberOfItems, 0);
assert.doesNotMatch(serializeJsonLd(venueCollectionStructuredData([{ ...time, name: '</script><script>bad()</script>' }])), /</);
assert.match(VENUES_SEARCH_TITLE, /Workshop.*Chennai/);
assert.ok(VENUES_SEARCH_DESCRIPTION.length <= 160);

const html = renderToStaticMarkup(createElement(VenueIndex, {
  venues, fallbackSlides: [], saved: {}, onToggleSave() {}, onOpenVenue() {},
}));
const $ = load(html);
for (const venue of venues) {
  assert.equal($(`h3 a[href="/venues/${venue.slug}"]`).text(), venue.name);
  assert.ok($(`img[alt="${venuePhotoAlt(venue, 0)}"]`).length > 0);
}

// The approved design must survive SEO copy updates. Compare literal styling
// and element structure with the checkout's committed baseline, not a new UI.
for (const file of ['Landing.tsx', 'VenueDetail.tsx', 'VenueIndex.tsx']) {
  const path = `components/venues/figma/${file}`;
  const before = execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' });
  const after = readFileSync(path, 'utf8');
  for (const attribute of ['className', 'style']) {
    const pattern = new RegExp(`${attribute}=(?:"[^"\\n]*"|'[^'\\n]*'|\\{[^\\n]*\\})`, 'g');
    assert.deepEqual(after.match(pattern), before.match(pattern), `${file}: ${attribute} must stay unchanged`);
  }
  const tags = (source: string) => source.match(/<\/?[A-Za-z][\w.]*(?=[\s/>])/g);
  assert.deepEqual(tags(after), tags(before), `${file}: no new sections or controls`);
}
console.log('PASS: local booking intent, honest restrictions, catalog facts, safe schema, crawlable links and unchanged design');
