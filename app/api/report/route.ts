import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const REASON_MAX_LENGTH = 300;

export async function POST(request: Request) {
  let body: { eventId?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const eventId = Number(body.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid eventId" }, { status: 400 });
  }
  const reason = (body.reason || "not specified").slice(0, REASON_MAX_LENGTH);

  try {
    const { rows: eventRows } = await query<{ id: number }>("SELECT id FROM events WHERE id = $1", [eventId]);
    if (eventRows.length === 0) {
      return NextResponse.json({ error: "event not found" }, { status: 404 });
    }

    // Always recorded, so the UI's "sent to curators" message is true even for
    // events with no discovery_item behind them.
    await query("INSERT INTO event_reports (event_id, reason) VALUES ($1, $2)", [eventId, reason]);

    const { rows: sourceRows } = await query<{ discovery_item_id: number | null }>(
      `SELECT discovery_item_id FROM event_sources
       WHERE event_id = $1 AND discovery_item_id IS NOT NULL
       ORDER BY added_at ASC LIMIT 1`,
      [eventId],
    );
    const discoveryItemId = sourceRows[0]?.discovery_item_id;

    if (discoveryItemId) {
      await query(
        "UPDATE discovery_items SET status = 'curator_pending', rejection_reason = $1 WHERE id = $2",
        [`REPORTED: ${reason}`, discoveryItemId],
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
