import { query } from "@/lib/db";
import { CATEGORIES, type Category, type PriceType } from "@/lib/types";

/**
 * Lifecycle states we surface publicly.
 *
 * `pending_review` is withheld (not curated yet) and `expired` is withheld
 * (the feed derives expiry from `startAt`, which stays correct even when the
 * nightly freshness sweep hasn't run). Cancelled/postponed/stale ARE surfaced
 * on purpose: someone who saved an event needs to find out it was called off,
 * and silently dropping it from the feed is how they'd end up travelling to a
 * venue for nothing.
 */
export type PublicEventStatus = "live" | "updated" | "postponed" | "cancelled" | "stale";

const PUBLIC_STATUSES: readonly PublicEventStatus[] = [
  "live",
  "updated",
  "postponed",
  "cancelled",
  "stale",
];

export interface PublicEvent {
  id: number;
  title: string;
  summary: string | null;
  /** 0-4 short, source-grounded phrases. Empty when the listing was vague. */
  highlights: string[];
  category: Category;
  startAt: string | null;
  endAt: string | null;
  isOnline: boolean;
  venueName: string | null;
  city: string;
  organizerName: string | null;
  posterImageUrl: string | null;
  /** null = the source never stated a price. Never render this as "Free". */
  priceType: PriceType | null;
  priceNote: string | null;
  primarySourceDomain: string;
  /** Extra domains the same event was found on — powers the "also seen on" line. */
  otherSourceDomains: string[];
  status: PublicEventStatus;
  discoveredAt: string;
  lastVerifiedAt: string | null;
}

export function parseCategoryParam(raw: string | null): Category | null {
  if (raw && (CATEGORIES as readonly string[]).includes(raw)) {
    return raw as Category;
  }
  return null;
}

/** Strips protocol/`www.` so domains from different columns compare equal. */
function bareDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase();
}

/**
 * Public field allowlist — deliberately never `SELECT *` and never returns
 * curator-internal detail (rejection reasons, extraction confidence, raw
 * search snippets, `chennai_relevance_score`), all of which live one join away
 * in discovery_items.
 */
export async function getPublicEvents(categories: Category[] | null): Promise<PublicEvent[]> {
  const { rows } = await query<{
    id: number;
    title: string;
    summary: string | null;
    highlights: string[];
    category: Category;
    startAt: string | null;
    endAt: string | null;
    isOnline: boolean;
    venueName: string | null;
    city: string;
    organizerName: string | null;
    posterImageUrl: string | null;
    priceType: PriceType | null;
    priceNote: string | null;
    primarySourceDomain: string;
    sourceDomains: string[] | null;
    status: PublicEventStatus;
    discoveredAt: string;
    lastVerifiedAt: string | null;
  }>(
    `SELECT
       e.id, e.title, e.summary, e.highlights, e.category, e.status,
       e.start_at          AS "startAt",
       e.end_at            AS "endAt",
       e.is_online         AS "isOnline",
       e.venue_name        AS "venueName",
       e.city,
       e.organizer_name    AS "organizerName",
       e.poster_image_url  AS "posterImageUrl",
       e.price_type        AS "priceType",
       e.price_note        AS "priceNote",
       regexp_replace(e.primary_source_url, '^https?://(www\\.)?([^/]+).*$', '\\2') AS "primarySourceDomain",
       COALESCE((
         SELECT array_agg(DISTINCT es.source_domain ORDER BY es.source_domain)
         FROM event_sources es
         WHERE es.event_id = e.id
       ), '{}') AS "sourceDomains",
       e.created_at        AS "discoveredAt",
       e.last_verified_at  AS "lastVerifiedAt"
     FROM events e
     WHERE e.status = ANY($1::text[])
       AND ($2::text[] IS NULL OR e.category = ANY($2::text[]))
     ORDER BY e.start_at ASC NULLS LAST, e.id ASC`,
    [PUBLIC_STATUSES, categories],
  );

  return rows.map(({ sourceDomains, primarySourceDomain, ...rest }) => {
    const primary = bareDomain(primarySourceDomain);
    return {
      ...rest,
      primarySourceDomain: primary,
      otherSourceDomains: (sourceDomains ?? [])
        .map(bareDomain)
        .filter((d) => d && d !== primary),
    };
  });
}
