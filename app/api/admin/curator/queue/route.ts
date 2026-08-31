import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";
import type { DiscoveryItemStatus } from "@/lib/types";

/**
 * Queue names the curator UI shows, mapped to the underlying
 * `discovery_items.status` values. Kept as an explicit allowlist so a crafted
 * `?queue=` can never widen the query beyond these.
 */
const QUEUE_STATUSES: Record<string, DiscoveryItemStatus[]> = {
  pending: ["curator_pending"],
  needs_correction: ["needs_correction"],
  rejected: ["curator_rejected", "rejected"],
  stale: ["stale"],
  duplicates: ["duplicate"],
  errors: ["error"],
};

const LIMIT = 200;

export async function GET(request: NextRequest) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const queueParam = request.nextUrl.searchParams.get("queue") ?? "pending";
  const statuses = QUEUE_STATUSES[queueParam];
  if (!statuses) {
    return NextResponse.json(
      { error: "unknown queue", allowed: Object.keys(QUEUE_STATUSES) },
      { status: 400 },
    );
  }

  try {
    const { rows: items } = await query(
      `SELECT di.id, di.title, di.snippet, di.url, di.source_domain, di.discovered_at,
              di.status, di.rejection_reason, di.extraction_meta, di.curator_draft,
              di.origin, di.event_id, sq.query_text
       FROM discovery_items di
       LEFT JOIN search_queries sq ON sq.id = di.query_id
       WHERE di.status = ANY($1::text[])
       ORDER BY di.discovered_at DESC, di.id DESC
       LIMIT ${LIMIT}`,
      [statuses],
    );

    // One grouped scan rather than a count query per queue — the sidebar needs
    // every badge on each load.
    const { rows: countRows } = await query<{ status: string; n: string }>(
      "SELECT status, count(*)::text AS n FROM discovery_items GROUP BY status",
    );
    const byStatus = new Map(countRows.map((r) => [r.status, Number(r.n)]));
    const counts = Object.fromEntries(
      Object.entries(QUEUE_STATUSES).map(([queue, sts]) => [
        queue,
        sts.reduce((sum, s) => sum + (byStatus.get(s) ?? 0), 0),
      ]),
    );

    const { rows: publishedRows } = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM events WHERE status <> 'pending_review'",
    );
    counts.published = Number(publishedRows[0]?.n ?? 0);

    return NextResponse.json({ ok: true, queue: queueParam, items, counts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
