import { query } from "@/lib/db";
import { eventApi } from "@/lib/eventApi";

/** Public event names only. Never returns approved staff numbers or private drafts. */
export async function GET(request: Request) {
  return eventApi(request, async () => ({
    events: (
      await query(`SELECT e.id,e.title FROM hosted_events h JOIN events e ON e.id=h.event_id
    WHERE e.status IN ('live','updated','postponed','cancelled','expired')
    AND EXISTS(SELECT 1 FROM event_host_access a WHERE a.event_id=e.id AND a.revoked_at IS NULL) ORDER BY e.start_at DESC,e.id DESC`)
    ).rows,
  }));
}
