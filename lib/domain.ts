/** Extracts a normalized registrable-ish host (lowercase, no "www.") from a URL for matching against sources.domain. */
export function normalizeDomain(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** Strips common tracking params so the same event isn't seen as two different URLs. */
export function normalizeUrl(url: string): string {
  const u = new URL(url);
  const stripPrefixes = ["utm_", "gclid", "fbclid", "mc_cid", "mc_eid"];
  for (const key of [...u.searchParams.keys()]) {
    if (stripPrefixes.some((p) => key.startsWith(p) || key === p)) {
      u.searchParams.delete(key);
    }
  }
  u.hash = "";
  return u.toString();
}
