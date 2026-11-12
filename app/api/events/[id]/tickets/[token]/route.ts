import { eventApi } from "@/lib/eventApi";
import { eventIdValue, EventTicketError } from "@/lib/hostedEventData";
import { getEventTicket } from "@/lib/eventRegistrations";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; token: string }> },
) {
  return eventApi(request, async () => {
    const { id, token } = await context.params;
    const ticket = await getEventTicket(eventIdValue(id), token);
    if (!ticket) throw new EventTicketError("Ticket not found.", 404);
    return { ticket };
  });
}
