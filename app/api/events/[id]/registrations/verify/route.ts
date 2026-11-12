import { eventApi, eventBody, eventUser } from "@/lib/eventApi";
import { eventIdValue } from "@/lib/hostedEventData";
import { verifyEventRegistration } from "@/lib/eventRegistrations";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return eventApi(request, async () =>
    verifyEventRegistration(
      eventIdValue((await context.params).id),
      (await eventUser(request)).id,
      await eventBody(request),
    ),
  );
}
