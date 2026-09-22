import { query } from "@/lib/db";

/**
 * Where a freshly-discovered URL goes before anyone looks at it.
 *
 * Lives here rather than inline in the discover route because listing-page
 * expansion (lib/extract.ts -> findJsonLdEventLinks) also creates discovery
 * items, and a child event must be routed by exactly the same rules as a URL
 * that arrived from search. Two copies of this logic would drift, and the
 * failure mode is silent: a blocked domain quietly becoming auto-fetchable.
 * New domains are enrolled below so public event platforms do not require a
 * code deploy before they can be fetched.
 */
export interface DiscoveryRoute {
  status: string;
  rejectionReason: string | null;
}

export async function routeDiscoveryItem(sourceDomain: string): Promise<DiscoveryRoute> {
  // LinkedIn is never auto-fetched regardless of what `sources` says: its
  // event pages are behind an auth wall, so an automated fetch yields a login
  // page rather than an event. A human has to open these.
  if (sourceDomain === "linkedin.com" || sourceDomain.endsWith(".linkedin.com")) {
    return { status: "curator_pending", rejectionReason: null };
  }

  const { rows } = await query<{ trust_tier: string; active: boolean }>(
    "SELECT trust_tier, active FROM sources WHERE domain = $1",
    [sourceDomain],
  );
  const src = rows[0];

  if (src && src.trust_tier === "blocked") {
    return { status: "rejected", rejectionReason: "blocked domain" };
  }
  if (src && src.trust_tier === "auto_fetch" && src.active) {
    return { status: "auto_processing", rejectionReason: null };
  }
  if (!src) {
    // Search results are public URLs, and safeFetchText still enforces HTTPS,
    // DNS/private-IP, redirect, size and content-type guards. Explicit
    // curator-only and blocked rows remain authoritative.
    await query(
      `INSERT INTO sources (domain, name, trust_tier, rate_limit_per_hour, active)
       VALUES ($1, $1, 'auto_fetch', 30, true)
       ON CONFLICT (domain) DO NOTHING`,
      [sourceDomain],
    );
    return { status: "auto_processing", rejectionReason: null };
  }

  // Existing inactive or curator-only sources remain human-reviewed.
  return { status: "curator_pending", rejectionReason: null };
}
