import { eventApi, eventBody } from "@/lib/eventApi";
import { checkCuratorAccess } from "@/lib/auth";
import { EventTicketError } from "@/lib/hostedEventData";
import {
  hostedEventAdminCatalog,
  prepareChapterLoungeDraft,
  saveHostedEventSettings,
} from "@/lib/hostedEventAdmin";
export async function GET(request: Request) {
  return eventApi(request, async () => {
    if (!(await checkCuratorAccess(request)))
      throw new EventTicketError("unauthorized", 401);
    return { events: await hostedEventAdminCatalog() };
  });
}
export async function POST(request: Request) {
  return eventApi(request, async () => {
    if (!(await checkCuratorAccess(request)))
      throw new EventTicketError("unauthorized", 401);
    const body = await eventBody(request);
    if (body.action === "prepare-chapter-lounge")
      return { ok: true, ...(await prepareChapterLoungeDraft()) };
    await saveHostedEventSettings(body);
    return { ok: true };
  });
}
