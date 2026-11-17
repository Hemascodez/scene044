import assert from 'node:assert/strict';
import { CHAPTER_LOUNGE_FIXTURE } from '../lib/hostedEvents';
import { eventSeoTitle, eventSeoDescription, eventStructuredData, eventPath } from '../lib/seo';
import { reviewEventSeo } from '../lib/eventSeoQuality';

const event = { ...CHAPTER_LOUNGE_FIXTURE, id: 186, title: 'Digital Dreamers Den (D3) Meetup #10',
  summary: 'Three talks about AI and full-stack engineering. Speakers discuss practical engineering ideas.',
  gist: null, highlights: ['Hear three tech talks on AI and full-stack engineering'],
  city: 'Chennai', venueName: 'Tekclan Software Solutions PVT. LTD.',
  venueAddress: '4th Floor, TICEL Biopark, Tharamani, Chennai',
  startAt: '2026-11-28T03:30:00Z', endAt: '2026-11-28T07:30:00Z', priceType: 'free' as const,
  hosted: null, hostedPricePaise: null,
};
const before = JSON.stringify(event);
const description = eventSeoDescription(event);
assert.ok(description.startsWith('Hear three tech talks'));
assert.ok(description.includes('28 Nov 2026'));
assert.ok(description.includes('9:00 am IST'));
assert.ok(description.includes('Chennai'));
assert.ok(description.endsWith('Free entry.'));
assert.ok(description.length <= 160);
assert.ok(eventSeoTitle(event).includes('#10'));
assert.equal(eventSeoTitle({ ...event, title: 'Shebuilds Chennai : Security Decoded' }), 'Shebuilds Chennai : Security Decoded | SCENE');
assert.equal(eventSeoTitle({ ...event, title: 'Bangalore Builders', city: 'Bengaluru' }), 'Bangalore Builders | SCENE');
assert.equal(eventSeoTitle({ ...event, city: '' }).includes('Chennai'), false);
assert.ok(eventSeoTitle({ ...event, isOnline: true, city: 'Chennai' }).includes('Online'));
const longAddress = { ...event, city: 'Bengaluru', venueName: 'Paytm office, 1st floor, B wing, the Hub, Sarjapur main road, Bellandur, bengaluru' };
assert.ok(eventSeoDescription(longAddress).startsWith('Hear three tech talks'));
assert.ok(eventSeoDescription(longAddress).includes('Paytm office, Bengaluru'));
assert.ok(!eventSeoDescription(longAddress).includes('1st floor'));
assert.ok(!eventSeoDescription({ ...event, startAt: 'invalid' }).includes('NaN'));
assert.ok(eventSeoDescription({ ...event, startAt: 'invalid' }).includes('date to be announced'));
assert.ok(eventSeoDescription({ ...event, gist: '**Three AI talks** with the community 🤖' }).startsWith('Three AI talks with the community.'));
assert.ok(!eventSeoDescription({ ...event, gist: 'At Meetup #9 we talked about AI.' }).includes('#9'));
assert.ok(!eventSeoDescription({ ...event, gist: 'Ready to build?' }).startsWith('Ready'));
assert.ok(eventSeoDescription({ ...event, gist: '🤖', highlights: ['C# engineering and full_stack workflows'] }).startsWith('C# engineering and full_stack workflows.'));
assert.ok(eventSeoDescription({ ...event, gist: null, highlights: ['Meetup #10 covers C#'] }).startsWith('Meetup #10 covers C#.'));
const compactTopic = eventSeoDescription({ ...event, gist: 'A long and detailed gist that lists all of the things taking place throughout the day at this community event with multiple speakers.' });
assert.ok(compactTopic.startsWith('Hear three tech talks on AI and full-stack engineering.'));
assert.ok(!compactTopic.includes('….'));
assert.ok(!eventSeoDescription({ ...event, city: 'Hyderabad', venueName: 'Hyderabad, Telangana, India' }).includes('Hyderabad, Hyderabad'));
assert.ok(!eventSeoDescription({ ...event, priceType: null, priceNote: null }).includes('Free entry'));
assert.ok(eventSeoDescription({ ...event, priceType: 'paid', hosted: { ...CHAPTER_LOUNGE_FIXTURE.hosted, pricePaise: 29900 } }).endsWith('₹299.'));
assert.ok(String(eventStructuredData(event)?.description).includes('Speakers discuss practical engineering ideas.'));
assert.equal(JSON.stringify(event), before, 'SEO must not mutate the event');
assert.equal(eventPath(event), '/events/digital-dreamers-den-d3-meetup-10-186');
const codes = (fields = {}) => reviewEventSeo({ ...event, ...fields }).map(issue => issue.code);
assert.ok(codes({ summary: 'An afternoon of AI discussions.' }).includes('daypart_conflict'));
assert.ok(!codes().includes('daypart_conflict'));
assert.ok(codes({ venueName: 'Register to See Address', venueAddress: null }).includes('withheld_venue'));
assert.ok(codes({ venueName: 'Bengaluru, India', city: 'Bengaluru' }).includes('withheld_venue'));
assert.ok(codes({ city: '' }).includes('missing_city'));
assert.ok(!codes({ city: '', isOnline: true }).includes('missing_city'));
assert.ok(codes({ priceType: null }).includes('unknown_price'));
assert.ok(codes({ startAt: '2026-11-21T00:00:00Z', endAt: '2026-11-22T00:00:00Z' }).includes('possible_date_only_time'));
assert.ok(codes({ startAt: null }).includes('missing_start'));
assert.ok(codes({ endAt: 'invalid' }).includes('invalid_end'));
console.log('PASS: source-grounded snippets, city/title deduplication, full schema descriptions, immutable facts and review gates.');
