import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";
import type { DiscoveryItemStatus } from "@/lib/types";
import { SOURCE_TYPES, classifySourceType, isCategory, type SourceType } from "@/lib/sourceTypes";

/**
 * Queue names the curator UI shows, mapped to the underlying
 * `discovery_items.status` values. Kept as an explicit allowlist so a crafted
 * `?queue=` can never widen the query beyond these.
 */
const QUEUE_STATUSES: Record<string, DiscoveryItemStatus[]> = {
  pending: ["curator_pending"],
  needs_correction: ["needs_correction"],
  rejected: ["curator_rejected", "rejected"],
  expired: ["expired"],
  needs_date_review: ["needs_date_review"],
  duplicates: ["duplicate"],
  errors: ["error"],
  // `new`/`auto_processing` are pipeline-internal states with no other
  // curator-visible queue — without this tab, a candidate rate-limited or
  // waiting its turn in extraction is indistinguishable from one that was
  // never discovered at all.
  in_progress: ["new", "auto_processing"],
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

  /*
   * Source and category are derived, not stored, so they are applied in JS
   * after the status query rather than in SQL. At LIMIT 200 that is free, and
   * it means adding a platform to the classifier needs no migration.
   */
  const sourceParam = request.nextUrl.searchParams.get("source");
  const sourceFilter =
    sourceParam && (SOURCE_TYPES as readonly string[]).includes(sourceParam)
      ? (sourceParam as SourceType)
      : null;

  const categoryParam = request.nextUrl.searchParams.get("category");
  const categoryFilter = categoryParam && isCategory(categoryParam) ? categoryParam : null;

  try {
    const { rows: items } = await query(
      `SELECT di.id, di.title, di.snippet, di.url, di.source_domain, di.discovered_at,
              di.status, di.rejection_reason, di.extraction_meta, di.curator_draft,
              di.origin, di.event_id, sq.query_text,
              COALESCE(ev.category, sq.category_hint) AS category
       FROM discovery_items di
       LEFT JOIN search_queries sq ON sq.id = di.query_id
       LEFT JOIN events ev ON ev.id = di.event_id
       WHERE di.status = ANY($1::text[])
       ORDER BY di.discovered_at DESC, di.id DESC
       LIMIT ${LIMIT}`,
      [statuses],
    );

    const filtered = (items as Record<string, unknown>[]).filter((item) => {
      if (sourceFilter && classifySourceType(String(item.source_domain ?? "")) !== sourceFilter) {
        return false;
      }
      if (categoryFilter && item.category !== categoryFilter) return false;
      return true;
    });

    // Facet counts come from the unfiltered set so the source dropdown still
    // shows what else is available once a filter is applied.
    const sourceCounts: Record<string, number> = {};
    for (const item of items as Record<string, unknown>[]) {
      const type = classifySourceType(String(item.source_domain ?? ""));
      sourceCounts[type] = (sourceCounts[type] ?? 0) + 1;
    }
    const categoryCounts: Record<string, number> = {};
    for (const item of items as Record<string, unknown>[]) {
      const c = item.category;
      if (typeof c === "string") categoryCounts[c] = (categoryCounts[c] ?? 0) + 1;
    }

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

    return NextResponse.json({
      ok: true,
      queue: queueParam,
      items: filtered,
      counts,
      facets: { source: sourceCounts, category: categoryCounts },
      applied: { source: sourceFilter, category: categoryFilter },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
