import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";

/** Everything already published, for the curator's "Published" queue. Unlike
 *  the public /api/events this includes pending_review and expired, because a
 *  curator needs to see and fix exactly the rows the public feed hides. */
export async function GET(request: NextRequest) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const search = (request.nextUrl.searchParams.get("q") ?? "").trim();

  try {
    const { rows } = await query(
      `SELECT e.id, e.title, e.category, e.status,
              e.start_at AS "startAt", e.end_at AS "endAt",
              e.is_online AS "isOnline", e.venue_name AS "venueName", e.venue_address AS "venueAddress", e.city,
              e.organizer_name AS "organizerName",
              e.poster_image_url AS "posterImageUrl",
              e.primary_source_url AS "primarySourceUrl",
              e.summary, e.highlights, e.source_type AS "sourceType",
              e.price_type AS "priceType", e.price_note AS "priceNote",
              e.last_verified_at AS "lastVerifiedAt",
              e.created_at AS "createdAt",
              (SELECT count(*)::int FROM event_sources es WHERE es.event_id = e.id) AS "sourceCount",
              (SELECT count(*)::int FROM event_reports r WHERE r.event_id = e.id AND r.resolved_at IS NULL) AS "openReports"
       FROM events e
       WHERE ($1 = '' OR e.title ILIKE '%' || $1 || '%' OR COALESCE(e.organizer_name,'') ILIKE '%' || $1 || '%')
       ORDER BY e.start_at ASC NULLS LAST, e.id DESC
       LIMIT 300`,
      [search],
    );
    return NextResponse.json({ ok: true, events: rows });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
