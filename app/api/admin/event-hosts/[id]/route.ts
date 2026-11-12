import { query } from "@/lib/db";
import { eventApi } from "@/lib/eventApi";
import { checkCuratorAccess } from "@/lib/auth";
import { eventIdValue, EventTicketError } from "@/lib/hostedEventData";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return eventApi(request, async () => {
    if (!(await checkCuratorAccess(request)))
      throw new EventTicketError("unauthorized", 401);
    const result = await query(
      "UPDATE event_host_access SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL RETURNING id",
      [eventIdValue((await context.params).id)],
    );
    if (!result.rows.length)
      throw new EventTicketError("Host access not found.", 404);
    return { ok: true };
  });
}
