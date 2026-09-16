import type { VenueEventType, VenueSpaceId } from "@/lib/venues";

export type VenueBookingStatus = "pending" | "approved" | "confirmed" | "declined";

export interface VenueBookingRequest {
  id: string;
  venueSlug: "time-cafe";
  venueName: string;
  spaceId: VenueSpaceId;
  spaceName: string;
  date: string;
  time: string;
  duration: number;
  people: number;
  eventType: VenueEventType;
  description: string;
  name: string;
  email: string;
  phone: string;
  trustType: "Instagram" | "LinkedIn" | "Website";
  trustUrl: string;
  whatsappOptIn: boolean;
  emailOptIn: boolean;
  agreedToPolicies: boolean;
  hourlyRate: number | null;
  total: number | null;
  status: VenueBookingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ManualVenueBlock {
  id: string;
  date: string;
  from: string;
  to: string;
  spaceName: string;
  note: string;
}

const BOOKING_KEY = "scene044.venueBookings.v1";
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

export function readVenueBookings(): VenueBookingRequest[] {
  if (typeof window === "undefined") return [];
  return safeParse<VenueBookingRequest[]>(window.localStorage.getItem(BOOKING_KEY), []);
}

export function createVenueBooking(
  payload: Omit<VenueBookingRequest, "id" | "status" | "createdAt" | "updatedAt">,
) {
  const now = new Date().toISOString();
  const request: VenueBookingRequest = {
    ...payload,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `req-${Date.now()}`,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  const bookings = readVenueBookings();
  window.localStorage.setItem(BOOKING_KEY, JSON.stringify([request, ...bookings]));
  notify();
  return request;
}

export function updateVenueBooking(id: string, status: VenueBookingStatus) {
  const next = readVenueBookings().map((request) =>
    request.id === id ? { ...request, status, updatedAt: new Date().toISOString() } : request,
  );
  window.localStorage.setItem(BOOKING_KEY, JSON.stringify(next));
  notify();
  return next.find((request) => request.id === id) ?? null;
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

export function createHostPreviewRequest(): VenueBookingRequest {
  const now = new Date();
  const future = new Date(now);
  future.setDate(now.getDate() + 9);
  return {
    id: "preview-request",
    venueSlug: "time-cafe",
    venueName: "Times Cafe",
    spaceId: "first-floor",
    spaceName: "First-floor event space",
    date: future.toISOString().slice(0, 10),
    time: "18:30",
    duration: 2,
    people: 26,
    eventType: "Tech meetup",
    description: "A practical evening meetup for Chennai product builders, followed by open networking.",
    name: "Arun Kumar",
    email: "arun@example.com",
    phone: "+91 98765 43210",
    trustType: "LinkedIn",
    trustUrl: "https://www.linkedin.com/in/example",
    whatsappOptIn: true,
    emailOptIn: true,
    agreedToPolicies: true,
    hourlyRate: 2000,
    total: 4000,
    status: "pending",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function savePreviewRequest(request: VenueBookingRequest) {
  if (readVenueBookings().some((item) => item.id === request.id)) return;
  window.localStorage.setItem(BOOKING_KEY, JSON.stringify([request, ...readVenueBookings()]));
  notify();
}
