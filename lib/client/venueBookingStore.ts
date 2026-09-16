/**
 * The organizer's own view of their bookings.
 *
 * Bookings themselves live in Postgres now (lib/venueBookings.ts, via
 * /api/venue-bookings), not in localStorage — the booking record the host
 * approves, gets paid against, and checks in against has to be the same row
 * everywhere. What still lives here is much smaller: which checkin tokens
 * belong to this browser, so "My bookings" knows which server records to ask
 * for without a login system. The token itself (48 hex chars) is the bearer
 * credential for reading — and, once scanned, checking in — that booking.
 */

export type VenueBookingStatus =
  | "requested"
  | "approved"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "declined"
  | "cancelled"
  | "expired";

export interface VenueBooking {
  id: number;
  code: string;
  checkinToken: string;
  venueSlug: string;
  venueName: string;
  spaceId: string;
  spaceName: string;
  eventDate: string;
  startTime: string;
  durationHours: number;
  people: number;
  eventType: string;
  description: string;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  trustType: string | null;
  trustUrl: string | null;
  whatsappOptIn: boolean;
  hourlyRate: number | null;
  total: number | null;
  status: VenueBookingStatus;
  checkedInAt: string | null;
  endsAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ManualVenueBlock {
  id: string;
  date: string;
  from: string;
  to: string;
  spaceName: string;
  note: string;
}

interface StoredBookingRef {
  token: string;
  /** Cached from creation time — the QR never changes for a booking's
   *  lifetime, so there's no need to regenerate it on every visit. */
  qrSvg: string;
}

const TOKENS_KEY = "scene044.venueBookingTokens.v1";
const BLOCK_KEY = "scene044.venueBlocks.v1";
const CHANGE_EVENT = "scene044:venue-bookings-changed";

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function venueBookingChangeEvent() {
  return CHANGE_EVENT;
}

/** The bookings this browser has created, most recent first. */
function myBookingRefs(): StoredBookingRef[] {
  if (typeof window === "undefined") return [];
  return safeParse<StoredBookingRef[]>(window.localStorage.getItem(TOKENS_KEY), []);
}

export function rememberBookingToken(token: string, qrSvg: string) {
  const refs = myBookingRefs();
  if (refs.some((ref) => ref.token === token)) return;
  window.localStorage.setItem(TOKENS_KEY, JSON.stringify([{ token, qrSvg }, ...refs]));
  notify();
}

/** Fetches the live server record for every remembered token, paired with
 *  its cached QR. A token whose booking has vanished (shouldn't happen, but
 *  a fetch can fail) is skipped rather than shown as an error — the rest of
 *  the list still renders. */
export async function fetchMyBookings(): Promise<Array<{ booking: VenueBooking; qrSvg: string }>> {
  const refs = myBookingRefs();
  const results = await Promise.all(
    refs.map(async (ref) => {
      try {
        const response = await fetch(`/api/venue-bookings/${ref.token}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.ok ? { booking: data.booking as VenueBooking, qrSvg: ref.qrSvg } : null;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((item): item is { booking: VenueBooking; qrSvg: string } => item !== null);
}

export function readManualVenueBlocks(): ManualVenueBlock[] {
  if (typeof window === "undefined") return [];
  return safeParse<ManualVenueBlock[]>(window.localStorage.getItem(BLOCK_KEY), []);
}

export function createManualVenueBlock(payload: Omit<ManualVenueBlock, "id">) {
  const block: ManualVenueBlock = { ...payload, id: `block-${Date.now()}` };
  window.localStorage.setItem(BLOCK_KEY, JSON.stringify([block, ...readManualVenueBlocks()]));
  notify();
  return block;
}
