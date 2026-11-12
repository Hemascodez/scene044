import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";
import {
  getVenueUserFromRequest,
  normalizeIndianPhone,
} from "@/lib/venueUserAuth";
import { isSameOriginMutation } from "@/lib/venueHostAccess";
import { eventIdValue, EventTicketError } from "@/lib/hostedEventData";

export const EVENT_HOST_ACCESS_MESSAGE =
  "Ask the event organiser or SCENE curator to approve your number for this event.";

export async function isApprovedEventHostPhone(
  rawPhone: string,
  eventId: number,
): Promise<boolean> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) return false;
  return (
    (
      await query(
        `SELECT id FROM event_host_access WHERE event_id=$1 AND phone_e164=$2 AND revoked_at IS NULL`,
        [eventId, phone],
      )
    ).rows.length > 0
  );
}

export async function requireEventHost(request: Request, eventId?: number) {
  if (!isSameOriginMutation(request))
    throw new EventTicketError("Use the SCENE event workspace.", 403);
  if (await checkCuratorAccess(request)) return null;
  const user = await getVenueUserFromRequest(request);
  if (!user) throw new EventTicketError("Sign in to run your event.", 401);
  // A normal SCENE session may access ONLY events with a current explicit approval.
  const allowed = eventId
    ? await isApprovedEventHostPhone(user.phoneE164, eventId)
    : (
        await query(
          "SELECT id FROM event_host_access WHERE phone_e164=$1 AND revoked_at IS NULL LIMIT 1",
          [user.phoneE164],
        )
      ).rows.length > 0;
  if (!allowed) {
    throw new EventTicketError(EVENT_HOST_ACCESS_MESSAGE, 403);
  }
  return user;
}

export async function listEventHostAccess() {
  return (
    await query(`SELECT h.id, h.event_id AS "eventId", e.title AS "eventTitle", h.phone_e164 AS phone,
    h.label, h.approved_at AS "approvedAt", h.revoked_at AS "revokedAt"
    FROM event_host_access h JOIN events e ON e.id=h.event_id
    ORDER BY (h.revoked_at IS NULL) DESC, h.id DESC`)
  ).rows;
}

export async function approveEventHost(input: {
  eventId: unknown;
  phone: unknown;
  label: unknown;
}) {
  const eventId = eventIdValue(input.eventId);
  const phone =
    typeof input.phone === "string" ? normalizeIndianPhone(input.phone) : null;
  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (!phone || label.length < 2 || label.length > 120)
    throw new EventTicketError(
      "Enter the host name and a valid Indian mobile number.",
    );
  const { rows } = await query(
    `INSERT INTO event_host_access(event_id,phone_e164,label)
    SELECT id,$2,$3 FROM events WHERE id=$1
    ON CONFLICT(event_id,phone_e164) DO UPDATE SET label=EXCLUDED.label,approved_at=now(),revoked_at=NULL
    RETURNING id`,
    [eventId, phone, label],
  );
  if (!rows.length) throw new EventTicketError("Choose an existing event.");
}
