import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { pool, query } from "@/lib/db";
import { EventTicketError } from "@/lib/hostedEventData";
import { eventPath } from "@/lib/seo";
import type { VenueUser } from "@/lib/venueUserAuth";
import type { Ticket } from "@/lib/client/eventRegistration";
import {
  createRazorpayOrder,
  fetchCapturedPayment,
  paymentForOrder,
  razorpayCheckoutKey,
  verifyRazorpayPaymentSignature,
  type RazorpayPayment,
} from "@/lib/razorpay";

type Registration = {
  id: number;
  event_id: number;
  user_id: number;
  name: string;
  email: string;
  phone_e164: string;
  registration_token: string;
  ticket_token: string;
  code: string;
  amount_paise: number;
  currency: string;
  status: string;
  order_id: string | null;
  payment_id: string | null;
};
type EventRow = {
  event_id: number;
  title: string;
  status: string;
  start_at: Date;
  end_at: Date | null;
  capacity: number;
  price_paise: number;
  registration_state: string;
  venue_name: string | null;
};

async function transaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function lockEvent(client: PoolClient, id: number): Promise<EventRow> {
  // Same lock order as curator edits and event cancellation: event, then ticketing.
  await client.query("SELECT id FROM events WHERE id=$1 FOR UPDATE", [id]);
  const { rows } = await client.query<EventRow>(
    `SELECT h.event_id,h.capacity,h.price_paise,h.registration_state,
    e.title,e.status,e.start_at,e.end_at,e.venue_name FROM hosted_events h JOIN events e ON e.id=h.event_id
    WHERE h.event_id=$1 FOR UPDATE OF h`,
    [id],
  );
  if (!rows[0]) throw new EventTicketError("Event not found.", 404);
  return rows[0];
}

function accepting(event: EventRow): boolean {
  return (
    ["live", "updated"].includes(event.status) &&
    event.registration_state === "open" &&
    Boolean(event.start_at) &&
    new Date(event.start_at).getTime() > Date.now()
  );
}

async function seatCounts(client: PoolClient, eventId: number, excludeId = 0) {
  const { rows } = await client.query<{ confirmed: number; held: number }>(
    `SELECT
    count(*) FILTER (WHERE status IN ('confirmed','checked_in'))::int AS confirmed,
    count(*) FILTER (WHERE status='pending' AND hold_until>now() AND id<>$2)::int AS held
    FROM event_registrations WHERE event_id=$1`,
    [eventId, excludeId],
  );
  return rows[0] ?? { confirmed: 0, held: 0 };
}

export function publicEventTicket(
  row: Pick<
    Registration,
    "code" | "name" | "phone_e164" | "status" | "ticket_token"
  >,
  eventId: number,
  title: string,
  cancelled = false,
): Ticket {
  return {
    code: row.code,
    name: row.name,
    phoneMasked: `+91 ••••• ${row.phone_e164.slice(-5)}`,
    status: cancelled || row.status === "cancelled" ? "cancelled" : "confirmed",
    qrValue: `https://scene044.in${eventPath({ id: eventId, title })}/ticket?ticket=${row.ticket_token}`,
  };
}

/** The event row is the serialization point for seat holds and all confirmations. */
export async function confirmEventPayment(
  registrationId: number,
  paymentId: string,
): Promise<{ ticket: Ticket; ticketToken: string; review: boolean }> {
  const { rows } = await query<Registration>(
    "SELECT * FROM event_registrations WHERE id=$1",
    [registrationId],
  );
  const initial = rows[0];
  if (!initial?.order_id)
    throw new EventTicketError("Registration not found.", 404);
  return transaction(async (client) => {
    const event = await lockEvent(client, initial.event_id);
    const { rows: locked } = await client.query<Registration>(
      "SELECT * FROM event_registrations WHERE id=$1 FOR UPDATE",
      [registrationId],
    );
    const row = locked[0];
    if (row.payment_id && row.payment_id !== paymentId)
      throw new EventTicketError(
        "This registration has a different payment.",
        409,
      );
    if (
      ["confirmed", "checked_in", "cancelled"].includes(row.status) &&
      row.payment_id === paymentId
    ) {
      return {
        ticket: publicEventTicket(
          row,
          row.event_id,
          event.title,
          event.status === "cancelled",
        ),
        ticketToken: row.ticket_token,
        review: row.status === "cancelled",
      };
    }
    const counts = await seatCounts(client, row.event_id, row.id);
    const canConfirm =
      ["live", "updated"].includes(event.status) &&
      new Date(
        event.end_at ?? new Date(event.start_at).getTime() + 2 * 60 * 60 * 1000,
      ).getTime() > Date.now() &&
      row.status !== "cancelled" &&
      counts.confirmed + counts.held < event.capacity;
    // Never capture an authorised late payment for a seat we can no longer supply.
    const existing = await paymentForOrder(row.order_id!);
    if (existing?.id !== paymentId)
      throw new EventTicketError(
        "Could not match this payment to your registration.",
        409,
      );
    if (existing.status === "authorized" && !canConfirm)
      throw new EventTicketError(
        "Your seat hold expired. This payment needs SCENE support; please do not pay again.",
        409,
      );
    const payment = await fetchCapturedPayment(paymentId, {
      orderId: row.order_id!,
      amountPaise: row.amount_paise,
      currency: row.currency,
    });
    if (payment.status !== "captured")
      throw new EventTicketError(
        "Your payment is not captured yet. Please retry confirmation.",
        409,
      );
    const { rows: saved } = await client.query<Registration>(
      `UPDATE event_registrations SET
      status=$2,payment_id=$3,fee_paise=$4,paid_at=COALESCE(paid_at,now()),updated_at=now()
      WHERE id=$1 RETURNING *`,
      [
        row.id,
        canConfirm ? "confirmed" : "payment_review",
        payment.id,
        Number.isSafeInteger(payment.fee) ? payment.fee : null,
      ],
    );
    if (canConfirm)
      await client.query(
        `INSERT INTO event_notifications(registration_id,kind)
      SELECT id,'ticket' FROM event_registrations WHERE id=$1 AND whatsapp_opt_in
      ON CONFLICT(registration_id,kind) DO NOTHING`,
        [row.id],
      );
    return {
      ticket: publicEventTicket(saved[0], row.event_id, event.title),
      ticketToken: row.ticket_token,
      review: !canConfirm,
    };
  });
}

export async function recoverEventRegistration(
  row: Pick<Registration, "id" | "order_id">,
): Promise<void> {
  if (!row.order_id) return;
  const payment = await paymentForOrder(row.order_id);
  if (payment?.status === "captured" || payment?.status === "authorized")
    await confirmEventPayment(row.id, payment.id);
}

export async function createEventRegistration(
  eventId: number,
  user: VenueUser,
  body: { name?: unknown; email?: unknown; whatsappOptIn?: unknown },
) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (
    name.length < 2 ||
    name.length > 120 ||
    email.length > 300 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    throw new EventTicketError("Enter your name and a valid email address.");
  const { rows: prior } = await query<Registration>(
    "SELECT * FROM event_registrations WHERE event_id=$1 AND user_id=$2",
    [eventId, user.id],
  );
  if (prior[0]?.status === "pending" && prior[0].order_id)
    await recoverEventRegistration(prior[0]);
  return transaction(async (client) => {
    const event = await lockEvent(client, eventId);
    const { rows: old } = await client.query<Registration>(
      "SELECT * FROM event_registrations WHERE event_id=$1 AND user_id=$2 FOR UPDATE",
      [eventId, user.id],
    );
    let row = old[0];
    if (row && ["confirmed", "checked_in"].includes(row.status))
      throw new EventTicketError("You're already registered.", 409, {
        existingTicketToken: row.ticket_token,
      });
    if (row?.payment_id || row?.status === "cancelled")
      throw new EventTicketError(
        "This registration needs SCENE support. Please do not make another payment.",
        409,
      );
    if (!accepting(event))
      throw new EventTicketError(
        event.status === "cancelled"
          ? "This event has been cancelled."
          : "Registration is not open for this event.",
        409,
      );
    const counts = await seatCounts(client, eventId, row?.id);
    if (counts.confirmed + counts.held >= event.capacity)
      throw new EventTicketError(
        "All seats are booked or temporarily held. Please try again shortly.",
        409,
        { soldOut: true },
      );
    if (!row) {
      const inserted = await client.query<Registration>(
        `INSERT INTO event_registrations
        (event_id,user_id,name,email,phone_e164,whatsapp_opt_in,registration_token,ticket_token,code,amount_paise)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          eventId,
          user.id,
          name,
          email,
          user.phoneE164,
          body.whatsappOptIn === true,
          crypto.randomBytes(32).toString("hex"),
          crypto.randomBytes(32).toString("hex"),
          `SCN-EVT-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
          event.price_paise,
        ],
      );
      row = inserted.rows[0];
    } else {
      await client.query(
        `UPDATE event_registrations SET name=$2,email=$3,whatsapp_opt_in=$4,
        hold_until=now()+interval '15 minutes',updated_at=now() WHERE id=$1`,
        [row.id, name, email, body.whatsappOptIn === true],
      );
    }
    if (!row.order_id) {
      const order = await createRazorpayOrder({
        amountPaise: row.amount_paise,
        currency: "INR",
        receipt: `scene-event-${row.id}`,
      });
      if (!order.ok)
        throw new EventTicketError(
          "Could not start payment. Please retry shortly.",
          503,
        );
      if (
        order.order.amount !== row.amount_paise ||
        order.order.currency !== "INR"
      )
        throw new EventTicketError(
          "Payment provider returned an unexpected order.",
          503,
        );
      row.order_id = order.order.id;
      await client.query(
        "UPDATE event_registrations SET order_id=$2,updated_at=now() WHERE id=$1",
        [row.id, row.order_id],
      );
    }
    return {
      registrationToken: row.registration_token,
      orderId: row.order_id,
      amount: row.amount_paise,
      currency: row.currency,
      keyId: razorpayCheckoutKey(),
    };
  });
}

export async function verifyEventRegistration(
  eventId: number,
  userId: number,
  body: Record<string, unknown>,
) {
  const { rows } = await query<Registration>(
    `SELECT * FROM event_registrations WHERE event_id=$1 AND user_id=$2 AND registration_token=$3`,
    [
      eventId,
      userId,
      typeof body.registrationToken === "string" ? body.registrationToken : "",
    ],
  );
  const row = rows[0];
  if (!row?.order_id)
    throw new EventTicketError("Registration not found.", 404);
  if (
    body.razorpay_order_id !== row.order_id ||
    typeof body.razorpay_payment_id !== "string" ||
    typeof body.razorpay_signature !== "string" ||
    !verifyRazorpayPaymentSignature({
      orderId: row.order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    })
  )
    throw new EventTicketError("Payment verification failed.", 400);
  const result = await confirmEventPayment(row.id, body.razorpay_payment_id);
  if (result.review)
    throw new EventTicketError(
      "Payment received, but your seat needs manual confirmation. Contact SCENE with your payment ID; do not pay again.",
      409,
    );
  return { ticket: result.ticket, ticketToken: result.ticketToken };
}

export async function getEventTicket(
  eventId: number,
  token: string,
): Promise<Ticket | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await query<
    Registration & { title: string; event_status: string }
  >(
    `SELECT r.*,e.title,e.status AS event_status
    FROM event_registrations r JOIN events e ON e.id=r.event_id WHERE r.event_id=$1 AND r.ticket_token=$2
    AND r.status IN ('confirmed','checked_in','cancelled') AND r.paid_at IS NOT NULL`,
    [eventId, token],
  );
  return rows[0]
    ? publicEventTicket(
        rows[0],
        eventId,
        rows[0].title,
        rows[0].event_status === "cancelled",
      )
    : null;
}

export async function myEventRegistrations(userId: number) {
  const pending = await query<Registration>(
    `SELECT * FROM event_registrations WHERE user_id=$1 AND status='pending' AND order_id IS NOT NULL ORDER BY id DESC LIMIT 5`,
    [userId],
  );
  for (const row of pending.rows) {
    try {
      await recoverEventRegistration(row);
    } catch {
      /* Keep uncertain payments pending; never create a second charge. */
    }
  }
  const { rows } = await query<
    Registration & {
      title: string;
      poster_image_url: string;
      start_at: Date;
      end_at: Date | null;
      venue_name: string;
      event_status: string;
    }
  >(
    `SELECT r.*,e.title,e.poster_image_url,e.start_at,e.end_at,e.venue_name,e.status AS event_status
    FROM event_registrations r JOIN events e ON e.id=r.event_id WHERE r.user_id=$1
    AND r.status IN ('confirmed','checked_in','cancelled') AND r.paid_at IS NOT NULL ORDER BY e.start_at,r.id`,
    [userId],
  );
  return rows.map((row) => ({
    eventId: row.event_id,
    slug: eventPath({ id: row.event_id, title: row.title }).split("/").at(-1),
    title: row.title,
    posterImageUrl: row.poster_image_url,
    startAt: new Date(row.start_at).toISOString(),
    endAt: row.end_at ? new Date(row.end_at).toISOString() : null,
    venueName: row.venue_name,
    ticket: publicEventTicket(
      row,
      row.event_id,
      row.title,
      row.event_status === "cancelled",
    ),
    ticketToken: row.ticket_token,
  }));
}

export async function handleCapturedEventPayment(
  payment: RazorpayPayment,
): Promise<boolean> {
  if (payment.status !== "captured") return false;
  const { rows } = await query<Registration>(
    "SELECT * FROM event_registrations WHERE order_id=$1",
    [payment.order_id],
  );
  if (!rows[0]) return false; // A venue order or another product is not an event registration.
  if (
    rows[0].amount_paise !== payment.amount ||
    rows[0].currency !== payment.currency
  )
    throw new EventTicketError("Payment amount mismatch.", 400);
  await confirmEventPayment(rows[0].id, payment.id);
  return true;
}
