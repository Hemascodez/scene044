import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { VenueIndex } from '../components/venues/figma/VenueIndex';
import ResponsiveVenueImage from '../components/venues/ResponsiveVenueImage';
import type { CatalogVenue } from '../lib/venueCatalog';

const venue: CatalogVenue = {
  id: 1, slug: 'fixture', name: 'Fixture Venue', area: 'Kilpauk', city: 'Chennai', address: null,
  summary: 'An unchanged design fixture.', status: 'live', rating: null, ratingCount: null, ratingUrl: null,
  phone: null, mapUrl: null, mapEmbedUrl: null, photos: ['/api/poster/132'], amenities: [], policies: [], spaces: [],
};
const html = renderToStaticMarkup(createElement(VenueIndex, {
  venues: [venue], fallbackSlides: [], saved: {}, onToggleSave() {}, onOpenVenue() {},
  venueHref: slug => `/venues/${slug}?people=20`,
}));
const $ = load(html);
assert.equal($('h3 a').attr('href'), '/venues/fixture?people=20');
assert.equal($('a[aria-label="View Fixture Venue"]').attr('href'), '/venues/fixture?people=20');
assert.equal($('button[aria-label="View Fixture Venue"]').length, 0);
assert.equal($('h3').attr('class'), 'mt-2 line-clamp-2 font-head text-xl leading-[27.5px]');
assert.equal($('a[aria-label="View Fixture Venue"]').attr('class'), 'press inline-flex min-h-11 items-center justify-center gap-2 border-[1.5px] border-ink bg-primary-ink px-4 font-mono-b text-xs tracking-[0.72px] uppercase text-white shadow-hard-sm');
assert.equal($('article').attr('class'), 'flex w-full min-w-0 flex-col border-[1.5px] border-ink bg-white shadow-hard');
assert.ok($('img').attr('srcset')?.includes('/_next/image?url=%2Fapi%2Fposter%2F132'));
assert.equal($('img').attr('sizes'), '(max-width: 768px) 86vw, (max-width: 1024px) 45vw, 400px');
assert.equal($('img').attr('alt'), 'Fixture Venue — photo 1');
const external = load(renderToStaticMarkup(createElement(ResponsiveVenueImage, { src: 'https://example.com/photo.jpg', alt: 'External photo', className: 'same-class' })));
assert.equal(external('img').attr('src'), 'https://example.com/photo.jpg');
assert.equal(external('img').attr('srcset'), undefined, 'external URLs are not proxied');
assert.equal(external('img').attr('class'), 'same-class');
console.log('PASS crawlable server-rendered venue links, retained search filters, identical card styling and responsive photo URLs');
