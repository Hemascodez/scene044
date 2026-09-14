import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";

/** Pins/unpins an event above the normal soonest-first order — a separate,
 *  single-purpose route from /api/admin/events/status because promotion and
 *  lifecycle status are independent axes (a promoted event can still be
 *  postponed, cancelled, etc). */
export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { eventId?: number; promoted?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const eventId = Number(body.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid eventId" }, { status: 400 });
  }
  if (typeof body.promoted !== "boolean") {
    return NextResponse.json({ error: "promoted must be a boolean" }, { status: 400 });
  }

  try {
    const { rows } = await query<{ id: number; promoted: boolean }>(
      `UPDATE events SET promoted = $1, updated_at = now() WHERE id = $2 RETURNING id, promoted`,
      [body.promoted, eventId],
    );
    if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, eventId: rows[0].id, promoted: rows[0].promoted });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
