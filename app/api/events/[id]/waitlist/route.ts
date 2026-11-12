import { query } from "@/lib/db";
import { eventApi, eventUser } from "@/lib/eventApi";
import { eventIdValue, EventTicketError } from "@/lib/hostedEventData";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return eventApi(request, async () => ({
    waitlisted:
      (
        await query(
          "SELECT user_id FROM event_waitlist WHERE event_id=$1 AND user_id=$2",
          [
            eventIdValue((await context.params).id),
            (await eventUser(request)).id,
          ],
        )
      ).rows.length > 0,
  }));
}
export async function POST(request: Request, context: Context) {
  return eventApi(request, async () => {
    const id = eventIdValue((await context.params).id);
    const user = await eventUser(request);
    const event = (
      await query<{ full: boolean }>(
        `SELECT (h.registration_state='sold_out' OR
      (SELECT count(*) FROM event_registrations r WHERE r.event_id=h.event_id AND r.status IN ('confirmed','checked_in'))>=h.capacity) AS full
      FROM hosted_events h JOIN events e ON e.id=h.event_id WHERE h.event_id=$1 AND e.status IN ('live','updated')
      AND e.start_at>now()`,
        [id],
      )
    ).rows[0];
    if (!event?.full)
      throw new EventTicketError(
        "The waitlist is only available for a published, sold-out event.",
        409,
      );
    await query(
      "INSERT INTO event_waitlist(event_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [id, user.id],
    );
    return { ok: true };
  });
}
export async function DELETE(request: Request, context: Context) {
  return eventApi(request, async () => {
    await query("DELETE FROM event_waitlist WHERE event_id=$1 AND user_id=$2", [
      eventIdValue((await context.params).id),
      (await eventUser(request)).id,
    ]);
    return { ok: true };
  });
}
