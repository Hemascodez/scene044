import { query } from "@/lib/db";
import { CATEGORIES, type Category, type PriceType } from "@/lib/types";
import { ASSUMED_DURATION_MS, EVENT_END_GRACE_MS } from "@/lib/eventDates";

/**
 * Lifecycle states we surface publicly.
 *
 * `pending_review` is withheld because it is not curated yet. `expired` is
 * withheld from feeds but remains available on its permanent detail URL. The
 * feed also derives expiry from `startAt`, which stays correct when the nightly
 * freshness sweep is behind. Cancelled/postponed events are surfaced on
 * purpose: silently dropping one is how someone ends up travelling to a venue
 * for an event that was called off.
 */
export type PublicEventStatus = "live" | "updated" | "postponed" | "cancelled";
export type PublicEventPageStatus = PublicEventStatus | "expired";

const PUBLIC_FEED_STATUSES: readonly PublicEventStatus[] = [
  "live",
  "updated",
  "postponed",
  "cancelled",
];

/** Published events keep a permanent detail page after they finish. */
export const PUBLIC_EVENT_PAGE_STATUSES: readonly PublicEventPageStatus[] = [
  ...PUBLIC_FEED_STATUSES,
  "expired",
];

export interface PublicEvent {
  id: number;
  title: string;
  summary: string | null;
  /** Three short, source-grounded takeaways. Empty when the listing was vague. */
  highlights: string[];
  /** Only populated when the source published a deadline. Usually null. */
  registrationNote: string | null;
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
  status: PublicEventPageStatus;
  discoveredAt: string;
  lastVerifiedAt: string | null;
}

/** Fields only the server-rendered event page needs. They stay out of the
 * browse-feed payload so every visitor doesn't download every source URL and
 * street address. */
export interface PublicEventDetail extends PublicEvent {
  venueAddress: string | null;
  primarySourceUrl: string;
  updatedAt: string;
}

export interface PublicEventSitemapEntry {
  id: number;
  title: string;
  category: Category;
  posterImageUrl: string | null;
  updatedAt: string;
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
    registrationNote: string | null;
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
       e.registration_note AS "registrationNote",
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
       /*
        * Upcoming only, decided in SQL rather than in the browser.
        * The client already hides past events, but that runs after the row has
        * been rendered into the HTML — so a finished event was still shipped to
        * every visitor and to search engines. An event with no date at all is
        * kept: undated is not the same as over, and those sort last anyway.
        */
       AND (
         COALESCE(e.end_at, e.start_at) IS NULL
         OR COALESCE(e.end_at, e.start_at) > now() - ($3::bigint * interval '1 millisecond')
       )
       AND ($2::text[] IS NULL OR e.category = ANY($2::text[]))
     ORDER BY e.start_at ASC NULLS LAST, e.id ASC`,
    [PUBLIC_FEED_STATUSES, categories, EVENT_END_GRACE_MS + ASSUMED_DURATION_MS],
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

/**
 * Single-event lookup for the canonical detail page and link-preview metadata.
 * Deliberately skips the "upcoming only" and category filters the feed applies:
 * a shared link to a past event should remain useful after the event ends.
 */
export async function getPublicEventById(id: number): Promise<PublicEventDetail | null> {
  const { rows } = await query<{
    id: number;
    title: string;
    summary: string | null;
    highlights: string[];
    registrationNote: string | null;
    category: Category;
    startAt: string | null;
    endAt: string | null;
    isOnline: boolean;
    venueName: string | null;
    venueAddress: string | null;
    city: string;
    organizerName: string | null;
    posterImageUrl: string | null;
    priceType: PriceType | null;
    priceNote: string | null;
    primarySourceUrl: string;
    primarySourceDomain: string;
    sourceDomains: string[] | null;
    status: PublicEventPageStatus;
    discoveredAt: string;
    lastVerifiedAt: string | null;
    updatedAt: string;
  }>(
    `SELECT
       e.id, e.title, e.summary, e.highlights, e.category, e.status,
       e.registration_note AS "registrationNote",
       e.start_at          AS "startAt",
       e.end_at            AS "endAt",
       e.is_online         AS "isOnline",
       e.venue_name        AS "venueName",
       e.venue_address     AS "venueAddress",
       e.city,
       e.organizer_name    AS "organizerName",
       e.poster_image_url  AS "posterImageUrl",
       e.price_type        AS "priceType",
       e.price_note        AS "priceNote",
       e.primary_source_url AS "primarySourceUrl",
       regexp_replace(e.primary_source_url, '^https?://(www\\.)?([^/]+).*$', '\\2') AS "primarySourceDomain",
       COALESCE((
         SELECT array_agg(DISTINCT es.source_domain ORDER BY es.source_domain)
         FROM event_sources es
         WHERE es.event_id = e.id
       ), '{}') AS "sourceDomains",
       e.created_at        AS "discoveredAt",
       e.last_verified_at  AS "lastVerifiedAt",
       e.updated_at        AS "updatedAt"
     FROM events e
     WHERE e.id = $1 AND e.status = ANY($2::text[])`,
    [id, PUBLIC_EVENT_PAGE_STATUSES],
  );

  const row = rows[0];
  if (!row) return null;
  const { sourceDomains, primarySourceDomain, ...rest } = row;
  const primary = bareDomain(primarySourceDomain);
  return {
    ...rest,
    primarySourceDomain: primary,
    otherSourceDomains: (sourceDomains ?? []).map(bareDomain).filter((d) => d && d !== primary),
  };
}

/** Canonical event URLs and real modification dates for sitemap.xml. */
export async function getPublicEventSitemapEntries(): Promise<PublicEventSitemapEntry[]> {
  const { rows } = await query<PublicEventSitemapEntry>(
    `SELECT
       e.id,
       e.title,
       e.category,
       e.poster_image_url AS "posterImageUrl",
       e.updated_at       AS "updatedAt"
     FROM events e
     WHERE e.status = ANY($1::text[])
     ORDER BY e.id ASC`,
    [PUBLIC_EVENT_PAGE_STATUSES],
  );
  return rows;
}
