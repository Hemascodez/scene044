import { eventApi, eventUser } from "@/lib/eventApi";
import { myEventRegistrations } from "@/lib/eventRegistrations";

export async function GET(request: Request) {
  return eventApi(request, async () => ({
    registrations: await myEventRegistrations((await eventUser(request)).id),
  }));
}
