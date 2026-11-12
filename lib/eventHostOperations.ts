import { pool, query } from "@/lib/db";
import { eventPath } from "@/lib/seo";
import { EventTicketError } from "@/lib/hostedEventData";
import type { VenueUser } from "@/lib/venueUserAuth";
import type { HostGuest } from "@/lib/client/eventHostApi";

export async function hostEventList(user: VenueUser | null) {
  const { rows } = await query<{
    id: number;
    title: string;
    startAt: Date;
    endAt: Date | null;
  }>(
    `SELECT e.id,e.title,e.poster_image_url AS "posterImageUrl",
    e.start_at AS "startAt",e.end_at AS "endAt",e.venue_name AS "venueName",h.capacity,h.price_paise AS "pricePaise",
    count(r.id) FILTER(WHERE r.status IN ('confirmed','checked_in'))::int AS "registeredCount",
    count(r.id) FILTER(WHERE r.status='checked_in')::int AS "checkedInCount"
    FROM hosted_events h JOIN events e ON e.id=h.event_id LEFT JOIN event_registrations r ON r.event_id=e.id
    WHERE ($1::text IS NULL OR EXISTS(SELECT 1 FROM event_host_access a WHERE a.event_id=e.id AND a.phone_e164=$1 AND a.revoked_at IS NULL))
    GROUP BY e.id,h.event_id ORDER BY e.start_at DESC,e.id DESC`,
    [user?.phoneE164 ?? null],
  );
  return rows.map((e) => ({
    ...e,
    slug: eventPath(e).split("/").at(-1),
    startAt: new Date(e.startAt).toISOString(),
    endAt: e.endAt ? new Date(e.endAt).toISOString() : null,
  }));
}

const GUEST_COLUMNS = `code,ticket_token AS "ticketToken",name,phone_e164 AS phone,email,
  CASE WHEN status='checked_in' THEN 'checked_in' WHEN status='cancelled' THEN 'cancelled' ELSE 'confirmed' END AS status,
  paid_at AS "registeredAt",checked_in_at AS "checkedInAt"`;
function normalizeGuest(row: HostGuest): HostGuest {
  return {
    ...row,
    registeredAt: new Date(row.registeredAt).toISOString(),
    checkedInAt: row.checkedInAt
      ? new Date(row.checkedInAt).toISOString()
      : null,
  };
}

export async function hostEventGuests(eventId: number) {
  return (
    await query<HostGuest>(
      `SELECT ${GUEST_COLUMNS} FROM event_registrations WHERE event_id=$1
    AND status IN ('confirmed','checked_in','cancelled') AND paid_at IS NOT NULL ORDER BY paid_at,id`,
      [eventId],
    )
  ).rows.map(normalizeGuest);
}

export async function checkInEventGuest(
  eventId: number,
  body: Record<string, unknown>,
) {
  const token = typeof body.token === "string" ? body.token : "";
  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (
    (!/^[a-f0-9]{64}$/.test(token) && !/^SCN-EVT-[A-F0-9]{10}$/.test(code)) ||
    (token && code)
  )
    throw new EventTicketError("Enter a valid ticket code or scan its QR.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const event = (
      await client.query<{ status: string }>(
        "SELECT status FROM events WHERE id=$1 FOR SHARE",
        [eventId],
      )
    ).rows[0];
    if (!event || event.status === "cancelled")
      throw new EventTicketError(
        "This event is cancelled or unavailable.",
        409,
      );
    const r = (
      await client.query<{ id: number; status: string }>(
        `SELECT id,status FROM event_registrations WHERE event_id=$1
      AND (ticket_token=$2 OR code=$3) AND paid_at IS NOT NULL FOR UPDATE`,
        [eventId, token, code],
      )
    ).rows[0];
    if (!r) throw new EventTicketError("No ticket matches that code.", 404);
    if (!["confirmed", "checked_in"].includes(r.status))
      throw new EventTicketError("This ticket is not valid for entry.", 409);
    const alreadyCheckedIn = r.status === "checked_in";
    if (!alreadyCheckedIn)
      await client.query(
        "UPDATE event_registrations SET status='checked_in',checked_in_at=now(),updated_at=now() WHERE id=$1",
        [r.id],
      );
    const guest = (
      await client.query<HostGuest>(
        `SELECT ${GUEST_COLUMNS} FROM event_registrations WHERE id=$1`,
        [r.id],
      )
    ).rows[0];
    await client.query("COMMIT");
    return { guest: normalizeGuest(guest), alreadyCheckedIn };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function hostEventMoney(eventId: number) {
  const { rows } = await query<{
    name: string;
    amount_paise: number;
    fee_paise: number | null;
    payment_id: string;
    paid_at: Date;
    status: string;
  }>(
    `SELECT name,amount_paise,fee_paise,payment_id,paid_at,status FROM event_registrations
    WHERE event_id=$1 AND payment_id IS NOT NULL ORDER BY paid_at DESC,id DESC`,
    [eventId],
  );
  const feesKnown = rows.every((r) => r.fee_paise !== null);
  const grossPaise = rows.reduce((sum, r) => sum + r.amount_paise, 0);
  const feesPaise = rows.reduce((sum, r) => sum + (r.fee_paise ?? 0), 0);
  return {
    grossPaise,
    feesPaise,
    feesKnown,
    netPaise: grossPaise - feesPaise,
    paymentsCount: rows.length,
    settlement:
      "Payments are collected by SCENE. Organiser payout is coordinated separately; this is not a bank-settlement confirmation.",
    reviewCount: rows.filter((r) => r.status === "payment_review").length,
    payments: rows.map((r) => ({
      at: new Date(r.paid_at).toISOString(),
      guest: r.name,
      amountPaise: r.amount_paise,
      paymentId: r.payment_id,
      status: "captured" as const,
    })),
  };
}
