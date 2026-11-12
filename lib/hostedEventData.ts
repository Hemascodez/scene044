import { query } from "@/lib/db";
import type { HostedEventInfo } from "@/lib/hostedEvents";

export async function getHostedEventInfo(
  eventId: number,
): Promise<HostedEventInfo | null> {
  const { rows } = await query<HostedEventInfo>(
    `SELECT h.host_name AS "hostName", h.host_person AS "hostPerson",
    h.price_paise AS "pricePaise", h.capacity, h.registration_state AS "registrationState",
    h.description, h.gallery, h.quote, h.good_to_know AS "goodToKnow", h.refund_policy AS "refundPolicy", h.terms,
    (SELECT count(*)::int FROM event_registrations r WHERE r.event_id=h.event_id
      AND r.status IN ('confirmed','checked_in')) AS "registeredCount"
    FROM hosted_events h WHERE h.event_id=$1`,
    [eventId],
  );
  return rows[0] ?? null;
}

export class EventTicketError extends Error {
  constructor(
    message: string,
    public status = 400,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function eventIdValue(raw: unknown): number {
  const id = typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : raw;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
    throw new EventTicketError("Choose a valid event.");
  return id;
}
