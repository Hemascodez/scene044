import { eventApi } from "@/lib/eventApi";
import { requireEventHost } from "@/lib/eventHostAccess";
import { hostEventList } from "@/lib/eventHostOperations";
export async function GET(request: Request) {
  return eventApi(request, async () => ({
    events: await hostEventList(await requireEventHost(request)),
  }));
}
