import { eventApi, eventBody } from "@/lib/eventApi";
import { requireEventHost } from "@/lib/eventHostAccess";
import { eventIdValue } from "@/lib/hostedEventData";
import {
  eventReminderStatus,
  queueEventReminder,
} from "@/lib/eventNotifications";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return eventApi(request, async () => {
    const id = eventIdValue((await context.params).id);
    await requireEventHost(request, id);
    return eventReminderStatus(id);
  });
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return eventApi(request, async () => {
    const id = eventIdValue((await context.params).id);
    const user = await requireEventHost(request, id);
    return queueEventReminder(
      id,
      (await eventBody(request)).templateId,
      user?.id ?? null,
    );
  });
}
