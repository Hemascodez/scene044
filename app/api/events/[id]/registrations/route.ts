import { eventApi, eventBody, eventUser } from "@/lib/eventApi";
import { eventIdValue } from "@/lib/hostedEventData";
import { createEventRegistration } from "@/lib/eventRegistrations";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return eventApi(request, async () =>
    createEventRegistration(
      eventIdValue((await context.params).id),
      await eventUser(request),
      await eventBody(request),
    ),
  );
}
