import { query } from "@/lib/db";
import { eventApi } from "@/lib/eventApi";
import {
  eventIdValue,
  EventTicketError,
  getHostedEventInfo,
} from "@/lib/hostedEventData";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return eventApi(request, async () => {
    const id = eventIdValue((await context.params).id);
    const visible = await query(
      "SELECT id FROM events WHERE id=$1 AND status IN ('live','updated','postponed','cancelled','expired')",
      [id],
    );
    if (!visible.rows.length)
      throw new EventTicketError("Event not found.", 404);
    const info = await getHostedEventInfo(id);
    if (!info) throw new EventTicketError("Event not found.", 404);
    return { registeredCount: info.registeredCount, capacity: info.capacity };
  });
}
