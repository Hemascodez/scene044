import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";
import type { EventStatus } from "@/lib/types";

/** Lifecycle transitions a curator may apply to a published event. */
const ALLOWED: EventStatus[] = ["live", "updated", "postponed", "cancelled", "expired", "pending_review"];

export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { eventId?: number; status?: string; expectedTitle?: string; expectedVenueName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const eventId = Number(body.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid eventId" }, { status: 400 });
  }
  if (!ALLOWED.includes(body.status as EventStatus)) {
    return NextResponse.json({ error: "invalid status", allowed: ALLOWED }, { status: 400 });
  }

  const hold = body.status === 'pending_review';
  if (hold && (typeof body.expectedTitle !== 'string' || !body.expectedTitle.trim()
    || typeof body.expectedVenueName !== 'string' || !body.expectedVenueName.trim())) {
    return NextResponse.json({ error: 'Current title and venue are required to hold an automatic import' }, { status: 400 });
  }

  try {
    const { rows } = await query<{ id: number; status: string }>(
      `UPDATE events
         SET status = $1, last_verified_at = now(), updated_at = now()
       WHERE id = $2
         AND ($3::boolean = false OR (
           source_type = 'auto' AND status IN ('live', 'updated')
           AND title = $4 AND venue_name = $5
           AND NOT EXISTS (SELECT 1 FROM hosted_events h WHERE h.event_id = events.id)
         ))
       RETURNING id, status`,
      [body.status, eventId, hold, body.expectedTitle ?? null, body.expectedVenueName ?? null],
    );
    if (rows.length === 0) return NextResponse.json({ error: "not found, changed or protected" }, { status: hold ? 409 : 404 });
    return NextResponse.json({ ok: true, eventId: rows[0].id, status: rows[0].status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
