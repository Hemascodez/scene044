import { eventApi, eventBody } from "@/lib/eventApi";
import { checkCuratorAccess } from "@/lib/auth";
import { EventTicketError } from "@/lib/hostedEventData";
import { approveEventHost, listEventHostAccess } from "@/lib/eventHostAccess";
import { hostedEventAdminCatalog } from "@/lib/hostedEventAdmin";
export async function GET(request: Request) {
  return eventApi(request, async () => {
    if (!(await checkCuratorAccess(request)))
      throw new EventTicketError("unauthorized", 401);
    return {
      hosts: await listEventHostAccess(),
      events: await hostedEventAdminCatalog(),
    };
  });
}
export async function POST(request: Request) {
  return eventApi(request, async () => {
    if (!(await checkCuratorAccess(request)))
      throw new EventTicketError("unauthorized", 401);
    const body = await eventBody(request);
    await approveEventHost({
      eventId: body.eventId,
      phone: body.phone,
      label: body.label,
    });
    return { ok: true };
  });
}
