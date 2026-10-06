/**
 * The organizer's own view of their bookings.
 *
 * Bookings themselves live in Postgres now (lib/venueBookings.ts, via
 * /api/venue-bookings), not in localStorage — the booking record the host
 * approves, gets paid against, and checks in against has to be the same row
 * everywhere. The account session now identifies which bookings belong to the
 * organizer, including when they sign in on another device.
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
  organizerUserId: number | null;
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

export function bookingCreated() {
  // The server owns the booking; an open list can refresh after creation.
  notify();
}

/** All bookings owned by this verified account, regardless of browser. */
export async function fetchMyBookings(signal?: AbortSignal): Promise<Array<{ booking: VenueBooking; qrSvg: string }>> {
  const response = await fetch("/api/venue-bookings", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Could not load your bookings. Try refreshing.");
  const data = await response.json();
  return data.entries as Array<{ booking: VenueBooking; qrSvg: string }>;
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
