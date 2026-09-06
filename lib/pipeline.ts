import { query } from "@/lib/db";
import {
  MissingSearchCredentialsError,
  SearchRateLimitedError,
  runSearchQuery,
  selectSearchProvider,
  type SearchProvider,
} from "@/lib/search";
import { normalizeDomain, normalizeUrl } from "@/lib/domain";
import { classifyEventUrl } from "@/lib/eventUrlPatterns";
import { routeDiscoveryItem } from "@/lib/discoveryRouting";
import { extractFromUrl, validateExtractedEvent } from "@/lib/extract";
import { categorizeEvent } from "@/lib/categorize";
import {
  findDuplicateEvent,
  DEDUP_HIGH_CONFIDENCE_THRESHOLD,
  DEDUP_LOW_CONFIDENCE_THRESHOLD,
} from "@/lib/dedup";
import { importPosterFromUrl } from "@/lib/posterStore";
import { summarizeEvent } from "@/lib/summarize";
import { safeFetchText } from "@/lib/safeFetch";
import type { ExtractionMeta } from "@/lib/types";

/**
 * The discovery pipeline, independent of any HTTP runtime.
 *
 * This lives here rather than inside the route handlers because the production
 * trigger is a scheduled container that runs `scripts/run-pipeline.ts` and
 * exits — no request, no response, and crucially no function timeout. A full
 * sweep of the active queries takes ~98 seconds, which exceeds the function
 * limit on most hosts; running it as a plain process sidesteps that entirely
 * and keeps the app host swappable.
 *
 * The API routes remain as thin wrappers so a run can still be triggered by
 * hand, and so both paths can never drift apart.
 */

export const DEFAULT_QUERY_LIMIT = 20;
export const MAX_QUERY_LIMIT = 100;
export const EXTRACT_BATCH_LIMIT = 25;

const CHENNAI_RELEVANCE_THRESHOLD = 0.4;

interface SearchQueryRow {
  id: number;
  query_text: string;
  site_filter: string | null;
}

interface PendingDiscoveryItemRow {
  id: number;
  url: string;
  source_domain: string;
}

interface DiscoveryItemRow {
  id: number;
  url: string;
  source_domain: string;
  query_id: number | null;
}

interface SourceRateLimitRow {
  rate_limit_per_hour: number;
  last_fetched_at: string | null;
}

export interface DiscoveryResult {
  provider: string;
  queriesRun: number;
  queryLimit: number;
  siteFilter: string | null;
  creditsUsed: number;
  stoppedEarly: string | null;
  routed: {
    auto_processing: number;
    curator_pending: number;
    rejected: number;
    listing_pages_seen: number;
  };
}

export interface ExtractionResult {
  processed: number;
  extracted: number;
  merged: number;
  needsReview: number;
  rejected: number;
  expandedListings: number;
  enqueuedFromLists: number;
}

async function markDiscoveryItem(
  id: number,
  status: string,
  rejectionReason: string | null,
  extractionMeta: ExtractionMeta | null,
  eventId: number | null,
) {
  await query(
    `UPDATE discovery_items
     SET status = $1, rejection_reason = $2, extraction_meta = $3, event_id = $4
     WHERE id = $5`,
    [status, rejectionReason, extractionMeta ? JSON.stringify(extractionMeta) : null, eventId, id],
  );
}

/**
 * Runs search queries and routes whatever they surface.
 *
 * Throws MissingSearchCredentialsError when no provider is configured, so the
 * caller can report a setup problem once instead of failing every query
 * identically.
 */
export async function runDiscovery(opts: {
  limit?: number;
  site?: string;
  provider?: SearchProvider;
} = {}): Promise<DiscoveryResult> {
  const provider = opts.provider ?? selectSearchProvider();

  // Free tiers differ by an order of magnitude (Google ~100/day, Firecrawl
  // ~350 searches/month), so the default comes from the provider itself.
  const limit =
    Number.isInteger(opts.limit) && (opts.limit as number) > 0
      ? Math.min(opts.limit as number, MAX_QUERY_LIMIT)
      : Math.min(provider.suggestedQueriesPerRun, DEFAULT_QUERY_LIMIT);

  const site = (opts.site ?? "").trim().toLowerCase();

  // Rotate: never-run queries (including newly seeded ones) go first, then the
  // least recently run. A full sweep therefore happens across several runs
  // without burning a whole day's quota at once.
  const { rows: queries } = await query<SearchQueryRow>(
    `SELECT id, query_text, site_filter FROM search_queries
     WHERE active = true
       AND ($2 = '' OR COALESCE(site_filter, '') ILIKE '%' || $2 || '%')
     ORDER BY last_run_at ASC NULLS FIRST, id ASC
     LIMIT $1`,
    [limit, site],
  );

  let creditsUsed = 0;
  let stoppedEarly: string | null = null;

  for (const row of queries) {
    try {
      const { results, creditsUsed: cost } = await runSearchQuery(
        row.query_text,
        row.site_filter,
        provider,
      );
      creditsUsed += cost ?? 0;

      for (const result of results) {
        const source_domain = normalizeDomain(result.link);
        await query(
          "INSERT INTO discovery_items (query_id, title, snippet, url, source_domain) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (url) DO NOTHING",
          [row.id, result.title, result.snippet, result.link, source_domain],
        );
      }

      await query("UPDATE search_queries SET last_run_at = now() WHERE id = $1", [row.id]);
    } catch (err) {
      if (err instanceof MissingSearchCredentialsError) throw err;
      // Quota or rate limit: every remaining query fails the same way, so stop
      // and still route whatever was already collected.
      if (err instanceof SearchRateLimitedError) {
        stoppedEarly = err.message;
        break;
      }
      console.error(`discover: search query ${row.id} failed`, err);
      continue;
    }
  }

  const { rows: pending } = await query<PendingDiscoveryItemRow>(
    "SELECT id, url, source_domain FROM discovery_items WHERE status = 'new'",
  );

  let autoProcessing = 0;
  let curatorPending = 0;
  let rejected = 0;
  let hubPages = 0;

  for (const row of pending) {
    /*
     * Listing pages are NOT rejected, despite looking like they should be.
     * Meetup group roots and Eventbrite feeds advertise their upcoming events
     * in JSON-LD, and lib/extract.ts expands them into individual items. An
     * earlier version rejected them outright and destroyed the only working
     * discovery path. This classification is a diagnostic signal only.
     */
    const urlKind = classifyEventUrl(row.url);
    const { status, rejectionReason } = await routeDiscoveryItem(row.source_domain);

    await query("UPDATE discovery_items SET status = $1, rejection_reason = $2 WHERE id = $3", [
      status,
      rejectionReason,
      row.id,
    ]);

    if (urlKind === "hub") hubPages++;
    if (status === "auto_processing") autoProcessing++;
    else if (status === "curator_pending") curatorPending++;
    else if (status === "rejected") rejected++;
  }

  return {
    provider: provider.name,
    queriesRun: queries.length,
    queryLimit: limit,
    siteFilter: site || null,
    creditsUsed,
    stoppedEarly,
    routed: {
      auto_processing: autoProcessing,
      curator_pending: curatorPending,
      rejected,
      listing_pages_seen: hubPages,
    },
  };
}

/** Fetches, extracts, categorises and dedups one batch of queued items. */
export async function runExtraction(opts: { batchLimit?: number } = {}): Promise<ExtractionResult> {
  const batchLimit = opts.batchLimit ?? EXTRACT_BATCH_LIMIT;

  const { rows: allowedSources } = await query<{ domain: string }>(
    "SELECT domain FROM sources WHERE trust_tier = 'auto_fetch' AND active = true",
  );
  const allowedDomains = allowedSources.map((s) => s.domain);

  const { rows: items } = await query<DiscoveryItemRow>(
    "SELECT id, url, source_domain, query_id FROM discovery_items WHERE status = 'auto_processing' LIMIT $1",
    [batchLimit],
  );

  let processed = 0;
  let extracted = 0;
  let merged = 0;
  let needsReview = 0;
  let rejected = 0;
  let expandedListings = 0;
  let enqueuedFromLists = 0;

  for (const item of items) {
    try {
      processed++;

      const { rows: srcRows } = await query<SourceRateLimitRow>(
        "SELECT rate_limit_per_hour, last_fetched_at FROM sources WHERE domain = $1",
        [item.source_domain],
      );
      const src = srcRows[0];

      // Politeness: one fetch per domain per (3600 / rate_limit) seconds. The
      // item keeps its status and is retried on the next run.
      if (src?.last_fetched_at) {
        const minGapMs = 3_600_000 / (src.rate_limit_per_hour || 30);
        if (Date.now() - new Date(src.last_fetched_at).getTime() < minGapMs) continue;
      }

      const outcome = await extractFromUrl(item.url, allowedDomains);
      await query("UPDATE sources SET last_fetched_at = now() WHERE domain = $1", [
        item.source_domain,
      ]);

      /*
       * Listing page: enqueue each advertised event as its own discovery item
       * rather than squeezing one event out of a page describing several. The
       * children route by the same rules as a search hit, and ON CONFLICT makes
       * re-expansion idempotent, so the same calendar can be re-read daily.
       */
      if (outcome.kind === "event_list") {
        for (const link of outcome.links) {
          let childDomain: string;
          try {
            childDomain = normalizeDomain(link.url);
          } catch {
            continue;
          }
          const route = await routeDiscoveryItem(childDomain);
          const inserted = await query(
            `INSERT INTO discovery_items (query_id, title, snippet, url, source_domain, status, rejection_reason, origin)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'search')
             ON CONFLICT (url) DO NOTHING`,
            [item.query_id, link.title, null, link.url, childDomain, route.status, route.rejectionReason],
          );
          if (inserted.rowCount) enqueuedFromLists++;
        }
        await markDiscoveryItem(item.id, "expanded", null, null, null);
        expandedListings++;
        continue;
      }

      const extractedEvent = outcome.kind === "event" ? outcome.event : null;

      if (!extractedEvent) {
        await markDiscoveryItem(item.id, "rejected", "extraction_failed", null, null);
        rejected++;
        continue;
      }

      const validation = validateExtractedEvent(extractedEvent);
      if (!validation.valid) {
        const meta: ExtractionMeta = {
          sourceMethod: extractedEvent.sourceMethod,
          confidence: extractedEvent.confidence,
          dateEvidence: extractedEvent.dateEvidence,
          venueEvidence: extractedEvent.venueEvidence,
        };
        if (validation.reason === "low_extraction_confidence") {
          await markDiscoveryItem(item.id, "curator_pending", validation.reason, meta, null);
          needsReview++;
        } else {
          await markDiscoveryItem(item.id, "rejected", validation.reason ?? "invalid_extraction", meta, null);
          rejected++;
        }
        continue;
      }

      const cat = await categorizeEvent({
        title: extractedEvent.title,
        summary: extractedEvent.summary,
        venueAddress: extractedEvent.venueAddress,
        isOnline: extractedEvent.isOnline,
      });

      if (!cat.category) {
        await markDiscoveryItem(item.id, "rejected", "no_confident_category", null, null);
        rejected++;
        continue;
      }

      if (cat.chennaiRelevanceScore < CHENNAI_RELEVANCE_THRESHOLD) {
        await markDiscoveryItem(item.id, "rejected", "not_chennai_relevant", null, null);
        rejected++;
        continue;
      }

      const dup = await findDuplicateEvent({
        title: extractedEvent.title,
        startAt: extractedEvent.startAt,
        isOnline: extractedEvent.isOnline,
        venueName: extractedEvent.venueName,
        organizerName: extractedEvent.organizerName,
        category: cat.category,
        url: item.url,
      });

      if (dup && dup.score >= DEDUP_HIGH_CONFIDENCE_THRESHOLD) {
        await query(
          `INSERT INTO event_sources (event_id, source_url, source_domain, discovery_item_id)
           VALUES ($1,$2,$3,$4) ON CONFLICT (event_id, source_url) DO NOTHING`,
          [dup.eventId, normalizeUrl(item.url), item.source_domain, item.id],
        );
        await markDiscoveryItem(item.id, "duplicate", null, null, dup.eventId);
        merged++;
        continue;
      }

      if (dup && dup.score >= DEDUP_LOW_CONFIDENCE_THRESHOLD) {
        const meta: ExtractionMeta = {
          sourceMethod: extractedEvent.sourceMethod,
          confidence: extractedEvent.confidence,
          possibleDuplicate: {
            eventId: dup.eventId,
            score: dup.score,
            reason: "medium_confidence_dedup_match",
          },
        };
        await markDiscoveryItem(item.id, "curator_pending", "possible_duplicate", meta, null);
        needsReview++;
        continue;
      }

      /*
       * Rewrite the organizer's description into something scannable.
       * JSON-LD `description` arrives verbatim — averaging ~950 characters and
       * running to 4,600, with markdown and boilerplate intact. Done here
       * rather than at render time so the cost is paid once per event, not
       * once per page view.
       */
      const editorial = await summarizeEvent({
        title: extractedEvent.title,
        rawSummary: extractedEvent.summary,
        category: cat.category,
        organizerName: extractedEvent.organizerName,
        registrationDeadline: extractedEvent.registrationDeadline ?? null,
      });

      // Re-host the poster rather than hotlinking: source URLs rot, and
      // hotlinking leaks every visitor's IP and referrer to that CDN.
      // Best-effort — a failed download falls back to the category Scene image.
      let posterImageUrl = extractedEvent.posterImageUrl;
      if (posterImageUrl) {
        const rehosted = await importPosterFromUrl(posterImageUrl, "auto");
        if (rehosted.ok) {
          posterImageUrl = rehosted.url;
        } else {
          console.warn(`extract: poster re-host failed for ${item.url}: ${rehosted.error}`);
          posterImageUrl = null;
        }
      }

      const {
        rows: [eventRow],
      } = await query<{ id: number }>(
        `INSERT INTO events (title, summary, highlights, registration_deadline, registration_note, category, start_at, end_at, is_online, venue_name, venue_address, organizer_name, poster_image_url, price_type, price_note, primary_source_url, source_type, chennai_relevance_score, status, last_verified_at)
         VALUES ($1,$2,$15,$16,$17,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'auto',$14,'live', now()) RETURNING id`,
        [
          extractedEvent.title,
          editorial.eventIntro,
          cat.category,
          extractedEvent.startAt,
          extractedEvent.endAt,
          extractedEvent.isOnline,
          extractedEvent.venueName,
          extractedEvent.venueAddress,
          extractedEvent.organizerName,
          posterImageUrl,
          extractedEvent.priceType,
          extractedEvent.priceNote,
          normalizeUrl(item.url),
          cat.chennaiRelevanceScore,
          editorial.whyAttend,
          extractedEvent.registrationDeadline ?? null,
          editorial.registrationNote,
        ],
      );

      await query(
        `INSERT INTO event_sources (event_id, source_url, source_domain, discovery_item_id)
         VALUES ($1,$2,$3,$4) ON CONFLICT (event_id, source_url) DO NOTHING`,
        [eventRow.id, normalizeUrl(item.url), item.source_domain, item.id],
      );
      await markDiscoveryItem(item.id, "auto_extracted", null, null, eventRow.id);
      extracted++;
    } catch (err) {
      await markDiscoveryItem(item.id, "error", String(err).slice(0, 500), null, null);
      rejected++;
    }
  }

  return { processed, extracted, merged, needsReview, rejected, expandedListings, enqueuedFromLists };
}

// ---------------------------------------------------------------- Verification

/** How long after an event's end (or start, when no end is published) it stops
 *  being shown. Generous enough that a same-day visitor still sees it. */
const EXPIRY_GRACE_MS = 12 * 60 * 60 * 1000;

/** Events re-checked per run. Small and rotating rather than exhaustive: this
 *  is someone else's server being polled about our own listings. */
const VERIFY_BATCH_LIMIT = 20;

export interface VerificationResult {
  expired: number;
  checked: number;
  stillLive: number;
  goneStale: number;
}

/**
 * Keeps the feed honest about time.
 *
 * Two separate jobs. Expiry is arithmetic — an event whose date has passed
 * should not be on a "what's on" page, and that needs no network. Verification
 * re-fetches the source page of the least recently checked live events and
 * marks the ones that have vanished as `stale`, which is what backs the
 * "freshness-checked" claim in the footer and the per-card freshness dot.
 *
 * A fetch failure is deliberately NOT treated as "gone": a timeout or a blip
 * would otherwise quietly unpublish a perfectly good event. Only an explicit
 * 404/410 counts as removed.
 */
export async function runVerification(): Promise<VerificationResult> {
  const { rowCount: expired } = await query(
    `UPDATE events
        SET status = 'expired', updated_at = now()
      WHERE status IN ('live', 'updated')
        AND COALESCE(end_at, start_at) IS NOT NULL
        AND COALESCE(end_at, start_at) < now() - ($1::bigint * interval '1 millisecond')`,
    [EXPIRY_GRACE_MS],
  );

  const { rows: allowedSources } = await query<{ domain: string }>(
    "SELECT domain FROM sources WHERE trust_tier = 'auto_fetch' AND active = true",
  );

  const { rows: due } = await query<{ id: number; primary_source_url: string }>(
    `SELECT id, primary_source_url FROM events
      WHERE status IN ('live', 'updated')
      ORDER BY last_verified_at ASC NULLS FIRST
      LIMIT $1`,
    [VERIFY_BATCH_LIMIT],
  );

  let checked = 0;
  let stillLive = 0;
  let goneStale = 0;

  for (const event of due) {
    checked++;
    let allowed = allowedSources.map((s) => s.domain);
    try {
      // The event's own host may not be an auto_fetch source (curator-added
      // events, one-off conference sites). We published this URL, so re-reading
      // it is in scope — but the SSRF guard still applies to every redirect hop.
      allowed = [...allowed, normalizeDomain(event.primary_source_url)];
    } catch {
      continue;
    }

    const result = await safeFetchText(event.primary_source_url, {
      allowedDomains: allowed,
      timeoutMs: 12_000,
    });

    // safeFetchText reports HTTP failures as `http_<status>` rather than a
    // numeric field, so match on that exact shape — a substring test would also
    // catch http_404x or a future http_4040.
    const gone = !result.ok && (result.reason === "http_404" || result.reason === "http_410");
    if (gone) {
      await query("UPDATE events SET status = 'stale', updated_at = now() WHERE id = $1", [event.id]);
      goneStale++;
      continue;
    }

    if (result.ok) {
      await query("UPDATE events SET last_verified_at = now() WHERE id = $1", [event.id]);
      stillLive++;
    }
    // Any other failure (timeout, block, network) is inconclusive — leave the
    // event alone and let the next run try again.
  }

  return { expired: expired ?? 0, checked, stillLive, goneStale };
}
