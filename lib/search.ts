/**
 * Web search, behind a provider interface.
 *
 * Google's Custom Search JSON API shuts down on 1 January 2027 and is already
 * closed to some new projects, so the search backend is deliberately swappable
 * rather than hard-coded. Adding a provider means implementing `SearchProvider`
 * and registering it below — no caller changes.
 */

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

export interface SearchResponse {
  results: SearchResult[];
  /** Provider-reported cost, when it reports one. Firecrawl bills credits; the
   *  discover route surfaces the running total so a free tier can be budgeted. */
  creditsUsed?: number;
}

export interface SearchProvider {
  readonly name: string;
  /** Which env vars are missing, empty array when ready to use. */
  missingConfig(): string[];
  search(queryText: string, siteFilter: string | null): Promise<SearchResponse>;
  /** Queries per discover run that fit this provider's free tier comfortably. */
  readonly suggestedQueriesPerRun: number;
}

/** Thrown when no provider is configured, so callers report a setup problem
 *  instead of retrying every query and logging N identical failures. */
export class MissingSearchCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingSearchCredentialsError";
  }
}

/** Retryable upstream refusal — the run should stop cleanly, not hammer on. */
export class SearchRateLimitedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchRateLimitedError";
  }
}

/**
 * Our `search_queries.site_filter` column stores Google syntax
 * (`site:linkedin.com/events`). Providers that take structured domain lists
 * need it split, and the path half kept for post-filtering — Firecrawl matches
 * hostnames only, so `linkedin.com/events` would otherwise pull in profiles,
 * company pages and feed posts alongside actual Events.
 */
export function parseSiteFilter(siteFilter: string | null): { domain: string; path: string } | null {
  if (!siteFilter) return null;
  const raw = siteFilter.trim().replace(/^site:/i, "").replace(/^https?:\/\//i, "");
  if (!raw) return null;
  const slash = raw.indexOf("/");
  return slash === -1
    ? { domain: raw.toLowerCase(), path: "" }
    : { domain: raw.slice(0, slash).toLowerCase(), path: raw.slice(slash) };
}

function matchesPath(link: string, path: string): boolean {
  if (!path) return true;
  try {
    return new URL(link).pathname.toLowerCase().startsWith(path.toLowerCase());
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- Google CSE

const googleProvider: SearchProvider = {
  name: "google-cse",
  // 100 queries/day free; 2 runs/day at 20 leaves plenty of headroom.
  suggestedQueriesPerRun: 20,

  missingConfig() {
    return [
      !process.env.GOOGLE_CSE_API_KEY && "GOOGLE_CSE_API_KEY",
      !process.env.GOOGLE_CSE_CX && "GOOGLE_CSE_CX",
    ].filter((v): v is string => !!v);
  },

  async search(queryText, siteFilter) {
    const q = siteFilter ? `${queryText} ${siteFilter}` : queryText;
    const url =
      `https://www.googleapis.com/customsearch/v1` +
      `?key=${process.env.GOOGLE_CSE_API_KEY}` +
      `&cx=${process.env.GOOGLE_CSE_CX}` +
      `&q=${encodeURIComponent(q)}&num=10`;

    const response = await fetch(url);
    if (response.status === 429) {
      throw new SearchRateLimitedError("Google CSE daily quota exhausted (100/day on the free tier).");
    }
    if (!response.ok) {
      throw new Error(`Google CSE failed with ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      items?: { title: string; snippet?: string; link: string }[];
    };
    return {
      results: (data.items ?? []).map((item) => ({
        title: item.title,
        snippet: item.snippet ?? "",
        link: item.link,
      })),
    };
  },
};

// ----------------------------------------------------------------- Firecrawl

const FIRECRAWL_RESULTS_PER_QUERY = 10; // 2 credits per 10 results

const firecrawlProvider: SearchProvider = {
  name: "firecrawl",
  /*
   * Free tier is 1,000 credits/month, shared across search and scrape:
   *   ~700 credits -> 350 searches (2 credits / 10 results)
   *   ~300 credits -> 300 page scrapes
   * At 2 runs/day, 6 queries per run is ~360 searches/month — inside budget
   * with room for the scrape path.
   */
  suggestedQueriesPerRun: 6,

  missingConfig() {
    return process.env.FIRECRAWL_API_KEY ? [] : ["FIRECRAWL_API_KEY"];
  },

  async search(queryText, siteFilter) {
    const site = parseSiteFilter(siteFilter);

    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: queryText,
        limit: FIRECRAWL_RESULTS_PER_QUERY,
        sources: ["web"],
        ...(site ? { includeDomains: [site.domain] } : {}),
        // Every query in this project is Chennai-scoped; telling the provider
        // beats hoping the words "Chennai" carry the localisation.
        location: "Chennai,Tamil Nadu,India",
        country: "IN",
      }),
    });

    if (response.status === 429) {
      throw new SearchRateLimitedError(
        "Firecrawl rate limit hit (10 searches/min on the free plan). Lower ?limit= or space the runs out.",
      );
    }
    if (response.status === 402) {
      throw new SearchRateLimitedError("Firecrawl credits exhausted for this month.");
    }
    if (!response.ok) {
      throw new Error(`Firecrawl failed with ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      success?: boolean;
      creditsUsed?: number;
      data?: { web?: { title?: string; description?: string; url?: string }[] };
    };

    const web = data.data?.web ?? [];
    const results = web
      .filter((r): r is { title?: string; description?: string; url: string } => !!r.url)
      // Firecrawl restricts by hostname only, so a path in the site filter
      // (site:linkedin.com/events) has to be applied here.
      .filter((r) => !site || matchesPath(r.url, site.path))
      .map((r) => ({
        title: r.title ?? "",
        snippet: r.description ?? "",
        link: r.url,
      }));

    return { results, creditsUsed: data.creditsUsed };
  },
};

// ------------------------------------------------------------------ Selection

const PROVIDERS: Record<string, SearchProvider> = {
  [googleProvider.name]: googleProvider,
  [firecrawlProvider.name]: firecrawlProvider,
};

/**
 * Explicit `SEARCH_PROVIDER` wins; otherwise the first fully-configured
 * provider is used. Firecrawl is tried first because Google's API has a known
 * shutdown date — if both are configured, the one with a future is preferred.
 */
export function selectSearchProvider(): SearchProvider {
  const explicit = process.env.SEARCH_PROVIDER?.trim();
  if (explicit) {
    const chosen = PROVIDERS[explicit];
    if (!chosen) {
      throw new MissingSearchCredentialsError(
        `SEARCH_PROVIDER="${explicit}" is not a known provider (${Object.keys(PROVIDERS).join(", ")}).`,
      );
    }
    const missing = chosen.missingConfig();
    if (missing.length > 0) {
      throw new MissingSearchCredentialsError(
        `SEARCH_PROVIDER is "${explicit}" but ${missing.join(" and ")} is empty.`,
      );
    }
    return chosen;
  }

  for (const provider of [firecrawlProvider, googleProvider]) {
    if (provider.missingConfig().length === 0) return provider;
  }

  throw new MissingSearchCredentialsError(
    "No search provider configured. Set FIRECRAWL_API_KEY, or GOOGLE_CSE_API_KEY together with GOOGLE_CSE_CX.",
  );
}

export async function runSearchQuery(
  queryText: string,
  siteFilter?: string | null,
  provider: SearchProvider = selectSearchProvider(),
): Promise<SearchResponse> {
  return provider.search(queryText, siteFilter ?? null);
}
