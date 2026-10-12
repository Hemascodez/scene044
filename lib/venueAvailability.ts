const WEEKDAYS_ONLY_VENUES = new Set(['the-freshlymade-resto-cafe']);

export function isWeekdaysOnlyVenue(slug: string): boolean {
  return WEEKDAYS_ONLY_VENUES.has(slug);
}

/** Booking dates are calendar dates in Chennai; UTC avoids the server's timezone. */
export function venueBookingDateError(slug: string, date: string): string | null {
  if (!isWeekdaysOnlyVenue(slug) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  const day = parsed.getUTCDay();
  return day === 0 || day === 6
    ? 'FreshlyMade accepts bookings Monday to Friday only. Choose a weekday date.'
    : null;
}
