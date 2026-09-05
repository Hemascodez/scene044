import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  MissingSearchCredentialsError,
  SearchRateLimitedError,
  runSearchQuery,
  selectSearchProvider,
} from "@/lib/search";
import { normalizeDomain } from "@/lib/domain";
import { classifyEventUrl } from "@/lib/eventUrlPatterns";
import { checkCronAuth } from "@/lib/auth";

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

interface SourceRow {
  trust_tier: string;
  active: boolean;
}

/**
 * Queries per run.
 *
 * Each one costs a Google Custom Search call, and the free tier is 100/day —
 * running all of them in a single pass would burn most of a day's quota and
 * risk the serverless time limit on top. Runs rotate instead: ordering by
 * last_run_at with NULLS FIRST means never-run queries (including newly seeded
 * ones) go first, then the least recently run.
 */
const DEFAULT_QUERY_LIMIT = 20;
const MAX_QUERY_LIMIT = 100;

export async function GET(request: Request) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  let provider;
  try {
    provider = selectSearchProvider();
  } catch (err) {
    if (err instanceof MissingSearchCredentialsError) {
      return NextResponse.json({ ok: false, error: err.message, setupRequired: true }, { status: 503 });
    }
    throw err;
  }

  const limitParam = Number(params.get("limit"));
  // Default comes from the provider, since free tiers differ by an order of
  // magnitude (Google ~100/day, Firecrawl ~350 searches/month).
  const limit =
    Number.isInteger(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_QUERY_LIMIT)
      : Math.min(provider.suggestedQueriesPerRun, DEFAULT_QUERY_LIMIT);

  // Optional single-platform run, e.g. ?site=linkedin.com — useful for
  // backfilling one source after adding queries for it, or for debugging a
  // platform in isolation without spending quota on everything else.
  const site = (params.get("site") ?? "").trim().toLowerCase();

  try {
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
            [row.id, result.title, result.snippet, result.link, source_domain]
          );
        }

        await query("UPDATE search_queries SET last_run_at = now() WHERE id = $1", [row.id]);
      } catch (err) {
        // A missing API key fails identically for every query — surface it once
        // as a setup error rather than burning the loop and the log.
        if (err instanceof MissingSearchCredentialsError) {
          return NextResponse.json(
            { ok: false, error: err.message, setupRequired: true },
            { status: 503 },
          );
        }
        // Quota or rate limit: every remaining query would fail the same way,
        // so stop and still route whatever was already collected.
        if (err instanceof SearchRateLimitedError) {
          stoppedEarly = err.message;
          break;
        }
        console.error(`discover: search query ${row.id} failed`, err);
        continue;
      }
    }

    const { rows: pending } = await query<PendingDiscoveryItemRow>(
      "SELECT id, url, source_domain FROM discovery_items WHERE status = 'new'"
    );

    let autoProcessing = 0;
    let curatorPending = 0;
    let rejected = 0;
    let hubPages = 0;

    for (const row of pending) {
      const { rows: srcRows } = await query<SourceRow>(
        "SELECT trust_tier, active FROM sources WHERE domain = $1",
        [row.source_domain]
      );
      const src = srcRows[0];

      let status: string;
      let rejection_reason: string | null = null;

      // A known platform's listing page (a Meetup group, an Eventbrite /d/
      // feed) describes many events or none. Rejecting it here saves a fetch, a
      // rate-limit slot and an LLM call, and keeps content-free hub pages from
      // reaching the categoriser — which scored an obviously-Chennai GDG group
      // "not Chennai relevant" purely because the page had no event text.
      const urlKind = classifyEventUrl(row.url);

      if (row.source_domain === "linkedin.com" || row.source_domain.endsWith(".linkedin.com")) {
        status = "curator_pending";
      } else if (urlKind === "hub") {
        status = "rejected";
        rejection_reason = "listing_page_not_an_event";
      } else if (src && src.trust_tier === "blocked") {
        status = "rejected";
        rejection_reason = "blocked domain";
      } else if (src && src.trust_tier === "auto_fetch" && src.active) {
        status = "auto_processing";
      } else {
        status = "curator_pending";
      }

      await query("UPDATE discovery_items SET status = $1, rejection_reason = $2 WHERE id = $3", [
        status,
        rejection_reason,
        row.id,
      ]);

      if (status === "rejected" && rejection_reason === "listing_page_not_an_event") {
        hubPages++;
      }
      if (status === "auto_processing") {
        autoProcessing++;
      } else if (status === "curator_pending") {
        curatorPending++;
      } else if (status === "rejected") {
        rejected++;
      }
    }

    return NextResponse.json({
      ok: true,
      provider: provider.name,
      queriesRun: queries.length,
      queryLimit: limit,
      siteFilter: site || null,
      creditsUsed: creditsUsed || undefined,
      stoppedEarly,
      routed: {
        auto_processing: autoProcessing,
        curator_pending: curatorPending,
        rejected: rejected,
        // Broken out so a sudden spike is visible — it means the queries have
        // drifted toward listing pages and need retuning.
        rejected_as_listing_page: hubPages,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
