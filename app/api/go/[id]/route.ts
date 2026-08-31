import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { rows } = await query<{ primary_source_url: string }>(
    "SELECT primary_source_url FROM events WHERE id = $1 AND status IN ('live', 'updated')",
    [eventId],
  );
  const event = rows[0];
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  try {
    await query("INSERT INTO clicks (event_id) VALUES ($1)", [eventId]);
  } catch (err) {
    console.error(`go: failed to log click for event ${eventId}`, err);
  }

  return NextResponse.redirect(event.primary_source_url, 302);
}
