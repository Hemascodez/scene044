import type { QueueItem, QueueKey } from "./client/curatorApi";
import { query } from "./db";

export type AddCandidateResult = { reused: boolean; discoveryItemId: number } & (
  | { destination: "event"; eventId: number }
  | { destination: "queue"; queue: Exclude<QueueKey, "published">; item: QueueItem }
);

const STATUS_QUEUE: Record<string, Exclude<QueueKey, "published">> = {
  curator_pending: "pending", needs_correction: "needs_correction",
  curator_rejected: "rejected", rejected: "rejected", expired: "expired",
  needs_date_review: "needs_date_review", duplicate: "duplicates",
  error: "errors", new: "in_progress", auto_processing: "in_progress",
};

/** An exact lookup must not depend on the first 200 queue / 300 event rows.
 * Opening a saved URL never republishes or re-extracts it. */
export async function findCuratorAddTarget(url: string): Promise<AddCandidateResult | null> {
  const { rows: [row] } = await query<QueueItem & { resolved_event_id: number | null }>(
    `SELECT di.id, di.title, di.snippet, di.url, di.source_domain, di.discovered_at,
            di.status, di.rejection_reason, di.extraction_meta, di.curator_draft,
            di.origin, di.event_id, sq.query_text,
            COALESCE(ev.category, sq.category_hint) AS category,
            ev.id AS resolved_event_id
     FROM discovery_items di
     LEFT JOIN search_queries sq ON sq.id = di.query_id
     LEFT JOIN event_aliases a ON a.duplicate_id = di.event_id
     LEFT JOIN events ev ON ev.id = COALESCE(a.canonical_id, di.event_id)
     WHERE di.url = $1`,
    [url],
  );
  if (!row) return null;
  const base = { reused: true, discoveryItemId: row.id };
  if (row.resolved_event_id !== null) {
    return { ...base, destination: "event", eventId: row.resolved_event_id };
  }
  const queue = STATUS_QUEUE[row.status];
  if (!queue || row.event_id !== null) {
    throw new Error(`Saved item #${row.id} has no accessible review or event. Please contact support; no duplicate was created.`);
  }
  const item = { ...row };
  Reflect.deleteProperty(item, "resolved_event_id");
  return { ...base, destination: "queue", queue, item };
}
