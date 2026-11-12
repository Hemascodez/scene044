import { eventApi } from "@/lib/eventApi";
import { requireEventHost } from "@/lib/eventHostAccess";
import { eventIdValue } from "@/lib/hostedEventData";
import { hostEventGuests } from "@/lib/eventHostOperations";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return eventApi(request, async () => {
    const id = eventIdValue((await context.params).id);
    await requireEventHost(request, id);
    return { guests: await hostEventGuests(id) };
  });
}
