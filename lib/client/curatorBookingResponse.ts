import type { VenueBooking } from '@/lib/venueBookings';

export type CuratorBookingRow = VenueBooking & { foodTotalPaise: number; paymentId: string | null };
export interface CuratorBookingList { bookings: CuratorBookingRow[]; count: number; page: number }

/** Never expose JSON parser exceptions, HTML error pages, or backend traces. */
export async function readCuratorBookingResponse(response: Response, fallback: string): Promise<Record<string, unknown>> {
  if (response.status === 401) throw new Error('Your curator session expired. Sign in again.');
  if (response.status === 403) throw new Error('You do not have permission to manage bookings.');
  if (response.status >= 500) throw new Error('Bookings are temporarily unavailable. Please retry.');
  const data: unknown = await response.json().catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(fallback);
  const record = data as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof record.error === 'string' ? record.error : fallback);
  return record;
}

export async function readCuratorBookingList(response: Response): Promise<CuratorBookingList> {
  const data = await readCuratorBookingResponse(response, 'Could not load bookings. Please retry.');
  if (!Array.isArray(data.bookings) || !Number.isSafeInteger(data.count) || Number(data.count) < 0 ||
      !Number.isSafeInteger(data.page) || Number(data.page) < 1 || !data.bookings.every(row =>
        row && typeof row === 'object' && Number.isSafeInteger(row.id) && typeof row.status === 'string' &&
        typeof row.code === 'string' && typeof row.organizerName === 'string')) {
    throw new Error('Could not load bookings. Please retry.');
  }
  return data as unknown as CuratorBookingList;
}
