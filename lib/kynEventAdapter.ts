import type { CheerioAPI } from "cheerio";

/** Parse JSON objects embedded in a public React page stream WITHOUT running
 * its JavaScript. Balanced JSON strings can contain braces/escaped quotes. */
function objectAt(text: string, start: number): Record<string, unknown> | null {
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < Math.min(text.length, start + 200_000); i++) {
    const ch = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

/** KYN's public event page streams its JSON-LD rather than placing a normal
 * script in the initial DOM. Use only the requested event and only a venue
 * explicitly marked showVenue=true; never import tickets, guest data or maps
 * coordinates hidden from the public UI. */
export function kynEmbeddedSchema($: CheerioAPI, pageUrl: string): Record<string, unknown> | null {
  const target = new URL(pageUrl);
  const id = target.pathname.match(/^\/event\/([a-f0-9]{24})\/?$/i)?.[1];
  if (!id || target.hostname.replace(/^www\./, "") !== "kynhood.com") return null;
  let stream = "";
  for (const el of $("script:not([src])").toArray()) {
    const script = $(el).text().trim();
    const match = script.match(/^self\.__next_f\.push\((\[[\s\S]*\])\);?$/);
    if (!match) continue;
    try {
      const part = JSON.parse(match[1]);
      if (part[0] === 1 && typeof part[1] === "string") stream += part[1];
    } catch { /* not a JSON data push; never evaluate source code */ }
    if (stream.length > 2_000_000) return null;
  }
  let own: Record<string, unknown> | null = null;
  for (const match of stream.matchAll(/\{\s*"@context"\s*:/g)) {
    const node = objectAt(stream, match.index!);
    if (node?.["@type"] !== "Event" || typeof node.url !== "string") continue;
    try {
      const candidate = new URL(node.url);
      if (candidate.origin === target.origin && candidate.pathname.replace(/\/$/, "") === target.pathname.replace(/\/$/, "")) { own = node; break; }
    } catch { /* malformed source URL */ }
  }
  if (!own) return null;
  const dataAt = stream.indexOf('"eventData":');
  const start = dataAt < 0 ? -1 : stream.indexOf("{", dataAt);
  const data = start < 0 ? null : objectAt(stream, start);
  const locations = Array.isArray(data?.locations) ? data.locations : [];
  // JSON-LD/hydration can contain an address even when the UI hides it. A
  // public venue opt-in is mandatory; do not copy that hidden address through.
  own = { ...own, location: undefined };
  if (data?.eventId === id && locations.length === 1) {
    const publicLocation = locations[0] as Record<string, unknown>;
    // A neighbourhood is not a street address; preserve the source's venue
    // string rather than inventing a postal address or geocoding privately.
    if (publicLocation.showVenue === true && typeof publicLocation.venue === "string" && publicLocation.venue.trim()) {
      own = { ...own, location: { "@type": "Place", name: publicLocation.venue.trim(), address: publicLocation.venue.trim() } };
    }
  }
  return own;
}
