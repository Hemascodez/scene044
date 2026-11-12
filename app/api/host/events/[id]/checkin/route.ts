import { eventApi, eventBody } from "@/lib/eventApi";
import { requireEventHost } from "@/lib/eventHostAccess";
import { eventIdValue } from "@/lib/hostedEventData";
import { checkInEventGuest } from "@/lib/eventHostOperations";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return eventApi(request, async () => {
    const id = eventIdValue((await context.params).id);
    await requireEventHost(request, id);
    return checkInEventGuest(id, await eventBody(request));
  });
}
