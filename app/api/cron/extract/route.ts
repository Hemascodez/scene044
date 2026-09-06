import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { checkCronAuth } from "@/lib/auth";
import { extractFromUrl, validateExtractedEvent } from "@/lib/extract";
import { categorizeEvent } from "@/lib/categorize";
import { normalizeDomain, normalizeUrl } from "@/lib/domain";
import { routeDiscoveryItem } from "@/lib/discoveryRouting";
import {
  findDuplicateEvent,
  DEDUP_HIGH_CONFIDENCE_THRESHOLD,
  DEDUP_LOW_CONFIDENCE_THRESHOLD,
} from "@/lib/dedup";
import type { ExtractionMeta } from "@/lib/types";
import { importPosterFromUrl } from "@/lib/posterStore";

const CHENNAI_RELEVANCE_THRESHOLD = 0.4;
const BATCH_LIMIT = 25;

interface DiscoveryItemRow {
  id: number;
  url: string;
  source_domain: string;
  /** Carried onto children of a listing page so provenance survives expansion. */
  query_id: number | null;
}

interface SourceRateLimitRow {
  rate_limit_per_hour: number;
  last_fetched_at: string | null;
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

export async function GET(request: Request) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { rows: allowedSources } = await query<{ domain: string }>(
      "SELECT domain FROM sources WHERE trust_tier = 'auto_fetch' AND active = true",
    );
    const allowedDomains = allowedSources.map((s) => s.domain);

    const { rows: items } = await query<DiscoveryItemRow>(
      "SELECT id, url, source_domain, query_id FROM discovery_items WHERE status = 'auto_processing' LIMIT $1",
      [BATCH_LIMIT],
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

        if (src?.last_fetched_at) {
          const minGapMs = 3_600_000 / (src.rate_limit_per_hour || 30);
          if (Date.now() - new Date(src.last_fetched_at).getTime() < minGapMs) {
            continue; // leave status as auto_processing, retry next run
          }
        }

        const outcome = await extractFromUrl(item.url, allowedDomains);
        await query("UPDATE sources SET last_fetched_at = now() WHERE domain = $1", [
          item.source_domain,
        ]);

        /*
         * Listing page: enqueue each advertised event as its own discovery
         * item rather than trying to squeeze one event out of a page that
         * describes several. The children are routed by the same rules as a
         * search hit, so a blocked or auth-walled domain can't sneak in this
         * way, and ON CONFLICT (url) makes re-expansion idempotent — the same
         * calendar can be re-read every day without duplicating anything.
         */
        if (outcome.kind === "event_list") {
          for (const link of outcome.links) {
            let childDomain: string;
            try {
              childDomain = normalizeDomain(link.url);
            } catch {
              continue; // unparseable child URL — skip it, keep the rest
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

        // Re-host the poster the extractor found rather than pointing the card
        // at someone else's CDN: source image URLs rot, and hotlinking leaks
        // every visitor's IP and referrer to that CDN. Best-effort — a failed
        // download must never stop the event being created, it just falls back
        // to the category Scene image.
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
          `INSERT INTO events (title, summary, category, start_at, end_at, is_online, venue_name, venue_address, organizer_name, poster_image_url, price_type, price_note, primary_source_url, source_type, chennai_relevance_score, status, last_verified_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'auto',$14,'live', now()) RETURNING id`,
          [
            extractedEvent.title,
            extractedEvent.summary,
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

    return NextResponse.json({
      ok: true,
      processed,
      extracted,
      merged,
      needsReview,
      rejected,
      expandedListings,
      enqueuedFromLists,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
