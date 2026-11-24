/**
 * The production pipeline trigger — a plain process, not an HTTP request.
 *
 * Railway's cron scheduler starts this container, it runs, and it exits. That
 * matters: a full discovery sweep takes ~98 seconds and extraction is fetch-
 * bound on top, both of which exceed the serverless function limits on Netlify
 * (10s) and the CPU cap on Cloudflare Workers free (10ms). As an ordinary Node
 * process there is no limit to exceed, and the web host stays swappable.
 *
 * Usage:
 *   npx tsx scripts/run-pipeline.ts                  # discover, then drain extraction
 *   npx tsx scripts/run-pipeline.ts --discover-only
 *   npx tsx scripts/run-pipeline.ts --extract-only
 *   npx tsx scripts/run-pipeline.ts --verify-only
 *   npx tsx scripts/run-pipeline.ts --cleanup-only   # weekly housekeeping
 *   npx tsx scripts/run-pipeline.ts --limit 20 --site meetup.com
 *   npx tsx scripts/run-pipeline.ts --max-minutes 5
 *   npx tsx scripts/run-pipeline.ts --market Mumbai,Delhi,Gurugram --max-publish 10
 *   npx tsx scripts/run-pipeline.ts --extract-only --city Mumbai --item-id 123
 */
import { pool } from "../lib/db";
import { createExtractionRunState, refreshDiscoveryFeeds, runCleanup, runDiscovery, runExtraction, runVerification } from "../lib/pipeline";
import { MissingSearchCredentialsError } from "../lib/search";
import { parseIngestionOptions } from "./event-ingestion-options";

/*
 * Extraction handles a bounded batch and is throttled to one fetch per domain
 * per politeness window (30s at the default 120/hour), so a single pass barely
 * dents the queue.
 *
 * Because this runs as a scheduled process rather than inside a request, it can
 * simply WAIT for the window to reopen instead of giving up — which is the
 * difference between draining the backlog tonight and dripping three items a
 * day. The wall-clock budget is the stop condition, not a pass count.
 */
const POLITENESS_WAIT_MS = 31_000;
const DEFAULT_MAX_MINUTES = 20;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const started = Date.now();
  const opts = parseIngestionOptions(process.argv.slice(2));
  const { discoverOnly, extractOnly, verifyOnly, cleanupOnly, markets, itemIds } = opts;
  const only = discoverOnly || extractOnly || verifyOnly || cleanupOnly;
  const requestedPublish = opts.maxPublish ?? Number(process.env.EVENT_MAX_PUBLISH_PER_RUN ?? 10);
  if (!Number.isInteger(requestedPublish) || requestedPublish < 0 || requestedPublish > 50) throw new Error("max-publish must be an integer between 0 and 50");
  console.log("pipeline-scope:", JSON.stringify({ markets, itemIds, maxPublish: requestedPublish }));

  if (!only || discoverOnly) {
    console.log("feeds:", JSON.stringify({ refreshed: await refreshDiscoveryFeeds({ markets }) }));
    try {
    const result = await runDiscovery({
      limit: opts.limit,
      site: opts.site,
      markets,
    });
    console.log("discovery:", JSON.stringify(result));
    if (result.stoppedEarly) console.warn("discovery stopped early:", result.stoppedEarly);
    } catch (error) {
      // Direct public feeds and the existing extraction queue still work when
      // a search provider is not configured. Report setup, don't abort them.
      if (!(error instanceof MissingSearchCredentialsError)) throw error;
      console.warn("discovery unavailable:", error.message);
    }
  }

  if (!only || extractOnly) {
    const maxMinutes = opts.maxMinutes ?? DEFAULT_MAX_MINUTES;
    const deadline = started + maxMinutes * 60_000;
    const totals = { processed: 0, extracted: 0, merged: 0, needsReview: 0, rejected: 0, expandedListings: 0, enqueuedFromLists: 0 };
    let passes = 0;
    const runState = createExtractionRunState();

    while (Date.now() < deadline) {
      const r = await runExtraction({ maxPublish: requestedPublish - totals.extracted, markets, itemIds, runState });
      passes++;
      for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += r[k];
      console.log("extraction-pass:", JSON.stringify(r));
      if (r.publicationLimitReached) { console.log("extraction: publication safety limit reached"); break; }
      if (r.processed === 0 && r.nextRetryAt && new Date(r.nextRetryAt).getTime() >= deadline) {
        console.log(`extraction: retries scheduled after this run's budget (${r.nextRetryAt})`);
        break;
      }

      if (r.processed === 0 && !r.rateLimited) {
        console.log(`extraction: queue empty after ${passes} pass(es)`);
        break;
      }

      // Nothing moved: every remaining item is inside its domain's politeness
      // window. Wait for it to reopen rather than abandoning the backlog.
      const didWork = r.extracted + r.merged + r.needsReview + r.rejected + r.expandedListings;
      if (didWork === 0) {
        if (Date.now() + POLITENESS_WAIT_MS >= deadline) {
          console.log(`extraction: ${maxMinutes}min budget reached after ${passes} pass(es)`);
          break;
        }
        await sleep(POLITENESS_WAIT_MS);
      }
    }
    console.log("extraction:", JSON.stringify({ passes, ...totals, processedByMarket: runState.processedByMarket,
      publishedByMarket: runState.publishedByMarket, skippedItemIds: runState.skippedItemIds }));
  }

  // Verification runs last so it sees anything this run just published.
  if (!markets.length && (!only || verifyOnly)) {
    console.log("verification:", JSON.stringify(await runVerification()));
  }

  // Cleanup is weekly, so it only runs when asked for explicitly.
  if (cleanupOnly) {
    console.log("cleanup:", JSON.stringify(await runCleanup()));
  }

  console.log(`pipeline finished in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main()
  .catch((err) => {
    if (err instanceof MissingSearchCredentialsError) {
      console.error("pipeline: setup problem —", err.message);
    } else {
      console.error("pipeline failed:", err);
    }
    process.exitCode = 1;
  })
  // The scheduler needs this process to exit; an open pool would hold it open.
  .finally(() => pool.end());
