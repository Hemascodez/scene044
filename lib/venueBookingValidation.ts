/** Shared form/API checks. Booking times are Chennai time, not the visitor's
 * browser timezone. Validate calendar dates before constructing an instant. */
export function validateVenueBookingWindow(date: string, time: string, duration: number, now = new Date()): { field: 'date' | 'start' | 'hours'; error: string } | null {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return { field: 'date', error: 'Choose a valid event date.' };
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { field: 'start', error: 'Choose a valid start time.' };
  if (!Number.isInteger(duration) || duration < 1 || duration > 24) return { field: 'hours', error: 'Choose a whole-hour duration of at least 1 hour.' };
  const [hour, minute] = time.split(':').map(Number);
  if (hour * 60 + minute + duration * 60 > 1440) return { field: 'hours', error: 'Choose a duration that ends before midnight.' };
  if (new Date(`${date}T${time}:00+05:30`).getTime() <= now.getTime()) return { field: 'date', error: 'Choose a future date and start time (Chennai time).' };
  return null;
}
