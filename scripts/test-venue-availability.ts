import assert from 'node:assert/strict';
import { isWeekdaysOnlyVenue, venueBookingDateError } from '../lib/venueAvailability';

assert.equal(isWeekdaysOnlyVenue('the-freshlymade-resto-cafe'), true);
assert.equal(isWeekdaysOnlyVenue('time-cafe'), false);
assert.equal(venueBookingDateError('the-freshlymade-resto-cafe', '2026-10-12'), null); // Monday
assert.equal(venueBookingDateError('the-freshlymade-resto-cafe', '2026-10-16'), null); // Friday
assert.match(venueBookingDateError('the-freshlymade-resto-cafe', '2026-10-17') ?? '', /Monday to Friday/); // Saturday
assert.match(venueBookingDateError('the-freshlymade-resto-cafe', '2026-10-18') ?? '', /Monday to Friday/); // Sunday
assert.equal(venueBookingDateError('time-cafe', '2026-10-17'), null);
assert.equal(venueBookingDateError('the-freshlymade-resto-cafe', '2026-02-30'), null); // date validation handles malformed dates
console.log('Venue weekday availability checks passed.');
