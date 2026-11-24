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

export class SearchCreditsExhaustedError extends SearchRateLimitedError {
  constructor() {
    super("Firecrawl credits exhausted; discovery stopped without purchasing credits.");
    this.name = "SearchCreditsExhaustedError";
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
export const FIRECRAWL_SEARCH_GAP_MS = 6_500;
const MAX_RATE_LIMIT_WAIT_MS = 60_000;

/** Serializes callers in this process, including retries. Other processes may
 * share the account, so even paced requests can receive a quota refusal. */
export function createFirecrawlProvider(clock = {
  now: () => Date.now(),
  sleep: (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms)),
}): SearchProvider {
  let nextRequestAt = 0;
  let tail: Promise<unknown> = Promise.resolve();
  return {
  name: "firecrawl",
  // Keep the existing bounded discovery budget; pacing does not increase it.
  suggestedQueriesPerRun: 20,

  missingConfig() {
    return process.env.FIRECRAWL_API_KEY ? [] : ["FIRECRAWL_API_KEY"];
  },

  search(queryText, siteFilter) {
    const task = tail.then(async () => {
    const site = parseSiteFilter(siteFilter);

    let response!: Response;
    for (let attempt = 0; attempt < 2; attempt++) {
    const wait = nextRequestAt - clock.now();
    if (wait > 0) await clock.sleep(wait);
    nextRequestAt = clock.now() + FIRECRAWL_SEARCH_GAP_MS;
    response = await fetch("https://api.firecrawl.dev/v2/search", {
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
        // Multi-city queries carry their own city. A Chennai bias here hid
        // Bengaluru, Mumbai and Kerala even when named in the query.
        location: "India",
        country: "IN",
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status !== 429) break;
    const header = response.headers.get("retry-after");
    const seconds = header && /^\d+(?:\.\d+)?$/.test(header) ? Number(header) * 1_000 : NaN;
    const headerWait = Number.isFinite(seconds) ? seconds : header ? Date.parse(header) - clock.now() : NaN;
    const retryWait = Number.isFinite(headerWait) ? Math.max(FIRECRAWL_SEARCH_GAP_MS, headerWait) : MAX_RATE_LIMIT_WAIT_MS;
    await response.body?.cancel();
    if (attempt > 0 || retryWait > MAX_RATE_LIMIT_WAIT_MS) {
      throw new SearchRateLimitedError("Firecrawl rate limit persists; discovery stopped after at most one bounded retry.");
    }
    nextRequestAt = Math.max(nextRequestAt, clock.now() + retryWait);
    }
    if (response.status === 402) {
      await response.body?.cancel();
      throw new SearchCreditsExhaustedError();
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
      .filter((r) => {
        if (!site) return true;
        try {
          const host = new URL(r.url).hostname.replace(/^www\./, "");
          return (host === site.domain || host.endsWith(`.${site.domain}`)) && matchesPath(r.url, site.path);
        } catch { return false; }
      })
      .map((r) => ({
        title: r.title ?? "",
        snippet: r.description ?? "",
        link: r.url,
      }));

    return { results, creditsUsed: data.creditsUsed };
    });
    tail = task.catch(() => undefined);
    return task;
  },
  };
}

const firecrawlProvider = createFirecrawlProvider();

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
