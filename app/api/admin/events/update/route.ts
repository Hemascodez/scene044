import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";
import { normalizeAdminEventUpdate } from "@/lib/adminEventUpdate";
import type { EventStatus } from "@/lib/types";

export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = normalizeAdminEventUpdate(raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const event = parsed.value;

  try {
    const result = await query<{ id: number; status: EventStatus }>(
      `UPDATE events SET title=$1, summary=$2, highlights=$3, category=$4, start_at=$5, end_at=$6,
       is_online=$7, venue_name=$8, venue_address=$9, organizer_name=$10, poster_image_url=$11,
       price_type=$12, price_note=$13, primary_source_url=$14, status=$15,
       last_verified_at=now(), updated_at=now()
       WHERE id=$16 RETURNING id, status`,
      [event.title, event.summary, event.highlights, event.category, event.startAt, event.endAt,
       event.isOnline, event.venueName, event.venueAddress, event.organizerName, event.posterImageUrl,
       event.priceType, event.priceNote, event.primarySourceUrl, event.status, event.eventId],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, eventId: result.rows[0].id, status: result.rows[0].status });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 500) }, { status: 500 });
  }
}
