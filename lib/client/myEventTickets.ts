import type { Ticket } from "@/lib/client/eventRegistration";

/**
 * The signed-in guest's hosted-event tickets, for My bookings. Shape fixed by
 * docs/hosted-event-backend-contract.md (GET /api/me/event-registrations).
 */
export interface MyEventTicket {
  eventId: number;
  slug: string;
  title: string;
  posterImageUrl: string | null;
  startAt: string;
  endAt: string | null;
  venueName: string | null;
  ticket: Ticket;
  /** Secret for the ?ticket= link that shows the QR. */
  ticketToken: string;
}

const ASSUMED_DURATION_MS = 2 * 60 * 60 * 1000;

function endOf(t: MyEventTicket): number {
  return t.endAt ? Date.parse(t.endAt) : Date.parse(t.startAt) + ASSUMED_DURATION_MS;
}

/** Upcoming (soonest first) vs past (most recent first); cancelled tickets are past. */
export function splitEventTickets(tickets: MyEventTicket[], now: Date = new Date()): { upcoming: MyEventTicket[]; past: MyEventTicket[] } {
  const upcoming: MyEventTicket[] = [];
  const past: MyEventTicket[] = [];
  for (const t of tickets) {
    if (t.ticket.status === "cancelled" || endOf(t) <= now.getTime()) past.push(t);
    else upcoming.push(t);
  }
  upcoming.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  past.sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));
  return { upcoming, past };
}

/** The event page shows the QR ticket for this link. */
export function eventTicketHref(t: MyEventTicket): string {
  return `/events/${t.slug}?ticket=${encodeURIComponent(t.ticketToken)}`;
}

/** [] when the endpoint doesn't exist yet (404), so My bookings keeps working. */
export async function fetchMyEventTickets(signal?: AbortSignal): Promise<MyEventTicket[]> {
  const response = await fetch("/api/me/event-registrations", { signal });
  if (response.status === 404 || response.status === 401) return [];
  if (!response.ok) throw new Error("Could not load your event tickets.");
  const data = (await response.json()) as { registrations?: MyEventTicket[] };
  return data.registrations ?? [];
}
