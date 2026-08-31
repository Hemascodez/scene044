import { pool, query } from "../lib/db";
import { extractEventFromUrl, validateExtractedEvent } from "../lib/extract";
import { findDuplicateEvent, DEDUP_HIGH_CONFIDENCE_THRESHOLD, DEDUP_LOW_CONFIDENCE_THRESHOLD } from "../lib/dedup";
import { normalizeUrl, normalizeDomain } from "../lib/domain";
import type { Category } from "../lib/types";

// Real, currently-live Chennai event URLs found via web search on 2026-08-30 —
// not fabricated. Each embeds real schema.org JSON-LD, so extraction below is
// genuinely real (no API key needed). Categorization is SIMULATED (no
// OPENAI_API_KEY provided yet) — clearly labeled, not passed off as real.
const REAL_TEST_URLS: { url: string; simulatedCategory: Category; simulatedRelevance: number }[] = [
  { url: "https://www.meetup.com/devday_chennai/", simulatedCategory: "tech", simulatedRelevance: 1.0 },
  { url: "https://www.meetup.com/indianstartupschennai/", simulatedCategory: "tech", simulatedRelevance: 1.0 },
  { url: "https://www.meetup.com/global-ai-community-chennai/", simulatedCategory: "ai", simulatedRelevance: 1.0 },
  { url: "https://www.meetup.com/chennai-ai-developers-group/", simulatedCategory: "ai", simulatedRelevance: 0.7 },
  // Known-stale listings (real pages, past dates) — must be REJECTED by validateExtractedEvent.
  { url: "https://lu.ma/crzq7d1g", simulatedCategory: "tech", simulatedRelevance: 1.0 },
  { url: "https://lu.ma/hf-chennai-meetup", simulatedCategory: "tech", simulatedRelevance: 1.0 },
  { url: "https://konfhub.com/aws-scd-2026-chennai", simulatedCategory: "cybersecurity", simulatedRelevance: 1.0 },
];

async function main() {
  const results: Record<string, number> = {
    fetched: 0,
    fetchFailed: 0,
    validationRejected: 0,
    merged: 0,
    needsReview: 0,
    inserted: 0,
  };

  // Mirrors the real /api/cron/extract route: the full auto_fetch allowlist,
  // not a single scoped domain, so redirects like lu.ma -> luma.com behave
  // exactly as they would in production.
  const { rows: allowedSources } = await query<{ domain: string }>(
    "SELECT domain FROM sources WHERE trust_tier = 'auto_fetch' AND active = true",
  );
  const allowedDomains = allowedSources.map((s) => s.domain);

  for (const test of REAL_TEST_URLS) {
    const domain = normalizeDomain(test.url);
    console.log(`\n=== ${test.url} ===`);

    const extracted = await extractEventFromUrl(test.url, allowedDomains);
    if (!extracted) {
      console.log("FETCH/EXTRACT FAILED");
      results.fetchFailed++;
      continue;
    }
    results.fetched++;
    console.log(`extracted: "${extracted.title}" via ${extracted.sourceMethod}, startAt=${extracted.startAt}`);

    const validation = validateExtractedEvent(extracted);
    if (!validation.valid) {
      console.log(`VALIDATION REJECTED: ${validation.reason}`);
      results.validationRejected++;
      continue;
    }

    console.log(`[SIMULATED categorization — no OPENAI_API_KEY] category=${test.simulatedCategory}, relevance=${test.simulatedRelevance}`);

    const dup = await findDuplicateEvent({
      title: extracted.title,
      startAt: extracted.startAt,
      isOnline: extracted.isOnline,
      venueName: extracted.venueName,
      organizerName: extracted.organizerName,
      category: test.simulatedCategory,
      url: test.url,
    });

    if (dup && dup.score >= DEDUP_HIGH_CONFIDENCE_THRESHOLD) {
      console.log(`DEDUP: HIGH-confidence match with event #${dup.eventId} (score ${dup.score.toFixed(2)}) — merging`);
      await query(
        `INSERT INTO event_sources (event_id, source_url, source_domain, discovery_item_id)
         VALUES ($1,$2,$3,NULL) ON CONFLICT (event_id, source_url) DO NOTHING`,
        [dup.eventId, normalizeUrl(test.url), domain],
      );
      results.merged++;
      continue;
    }
    if (dup && dup.score >= DEDUP_LOW_CONFIDENCE_THRESHOLD) {
      console.log(`DEDUP: MEDIUM-confidence match with event #${dup.eventId} (score ${dup.score.toFixed(2)}) — would route to curator review`);
      results.needsReview++;
      continue;
    }
    console.log(dup ? `DEDUP: best score ${dup.score.toFixed(2)}, below LOW threshold — new event` : "DEDUP: no candidates — new event");

    const {
      rows: [eventRow],
    } = await query<{ id: number }>(
      `INSERT INTO events (title, summary, category, start_at, end_at, is_online, venue_name, venue_address, organizer_name, poster_image_url, primary_source_url, source_type, chennai_relevance_score, status, last_verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'auto',$12,'live', now()) RETURNING id`,
      [
        extracted.title, extracted.summary, test.simulatedCategory, extracted.startAt, extracted.endAt,
        extracted.isOnline, extracted.venueName, extracted.venueAddress, extracted.organizerName,
        extracted.posterImageUrl, normalizeUrl(test.url), test.simulatedRelevance,
      ],
    );
    await query(
      `INSERT INTO event_sources (event_id, source_url, source_domain, discovery_item_id)
       VALUES ($1,$2,$3,NULL) ON CONFLICT (event_id, source_url) DO NOTHING`,
      [eventRow.id, normalizeUrl(test.url), domain],
    );
    console.log(`INSERTED as event #${eventRow.id}`);
    results.inserted++;
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
