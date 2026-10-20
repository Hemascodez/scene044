import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";

// The curator must see events inserted by the latest scraper run immediately.
// Do not let Next/Railway serve a cached snapshot of this admin read.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Active published events for the curator's "Published" queue. An explicit
 * curator-only id lookup can also open an expired event without reviving it. */
export async function GET(request: NextRequest) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const search = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const rawId = request.nextUrl.searchParams.get("id");
  const id = rawId === null ? null : Number(rawId);
  if (id !== null && (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647)) {
    return NextResponse.json({ error: "invalid event id" }, { status: 400 });
  }

  try {
    const { rows } = await query(
      `SELECT e.id, e.title, e.category, e.status, e.tags, e.is_promoted AS "isPromoted",
              e.start_at AS "startAt", e.end_at AS "endAt",
              e.is_online AS "isOnline", e.venue_name AS "venueName", e.venue_address AS "venueAddress", e.city,
              e.organizer_name AS "organizerName",
              e.poster_image_url AS "posterImageUrl",
              e.primary_source_url AS "primarySourceUrl",
              e.summary, e.highlights, e.tags, e.is_promoted AS "isPromoted", e.source_type AS "sourceType",
              e.price_type AS "priceType", e.price_note AS "priceNote",
              e.last_verified_at AS "lastVerifiedAt",
              e.created_at AS "createdAt",
              (SELECT count(*)::int FROM event_sources es WHERE es.event_id = e.id) AS "sourceCount",
              (SELECT count(*)::int FROM event_reports r WHERE r.event_id = e.id AND r.resolved_at IS NULL) AS "openReports"
       FROM events e
       WHERE ($2::integer IS NULL AND e.status <> 'expired' OR e.id = $2::integer)
         AND ($1 = '' OR e.title ILIKE '%' || $1 || '%' OR COALESCE(e.organizer_name,'') ILIKE '%' || $1 || '%')
       ORDER BY e.is_promoted DESC, e.start_at ASC NULLS LAST, e.id DESC
       LIMIT 300`,
      [search, id],
    );
    return NextResponse.json(
      { ok: true, events: rows },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
