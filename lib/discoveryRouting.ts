import { query } from "@/lib/db";

/**
 * Where a freshly-discovered URL goes before anyone looks at it.
 *
 * Lives here rather than inline in the discover route because listing-page
 * expansion (lib/extract.ts -> findJsonLdEventLinks) also creates discovery
 * items, and a child event must be routed by exactly the same rules as a URL
 * that arrived from search. Two copies of this logic would drift, and the
 * failure mode is silent: a blocked domain quietly becoming auto-fetchable.
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
  // Unknown domains default to human review, never to auto-fetch.
  return { status: "curator_pending", rejectionReason: null };
}
