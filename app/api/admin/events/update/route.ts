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
      `UPDATE events SET title=$1, summary=$2, highlights=$3, tags=$4, is_promoted=$5,
       category=$6, start_at=$7, end_at=$8,
       is_online=$9, venue_name=$10, venue_address=$11, organizer_name=$12, poster_image_url=$13,
       price_type=$14, price_note=$15, primary_source_url=$16, status=$17,
       last_verified_at=now(), updated_at=now()
       WHERE id=$18 RETURNING id, status`,
      [event.title, event.summary, event.highlights, event.tags, event.isPromoted, event.category,
       event.startAt, event.endAt, event.isOnline, event.venueName, event.venueAddress,
       event.organizerName, event.posterImageUrl, event.priceType, event.priceNote,
       event.primarySourceUrl, event.status, event.eventId],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, eventId: result.rows[0].id, status: result.rows[0].status });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 500) }, { status: 500 });
  }
}
