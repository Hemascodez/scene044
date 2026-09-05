/**
 * Tells an event *detail* page apart from a listing/hub page, per platform.
 *
 * Search reliably surfaces hubs — `meetup.com/chennai-meetup-group/`,
 * `lu.ma/ai`, `eventbrite.com/d/india--chennai/tech-meetup/`. They're real
 * pages, but they describe many events or none, so extraction finds no single
 * Event to pull and the item burns a fetch, a rate-limit slot and an LLM call
 * before being rejected. Worse, a group page has so little event text that the
 * categoriser scored an obviously-Chennai GDG group as "not Chennai relevant".
 *
 * Classifying up front turns that into a cheap, honest rejection at discovery
 * time. Only domains we actually understand are judged — anything unrecognised
 * stays `unknown` and follows the normal path rather than being silently
 * dropped on a guess.
 */
export type UrlKind = "event" | "hub" | "unknown";

interface DomainRules {
  /** Path must match one of these to be an event detail page. */
  event?: RegExp[];
  /** Definitely a listing/search/hub page. Checked before `event`. */
  hub?: RegExp[];
}

const RULES: Record<string, DomainRules> = {
  // https://www.meetup.com/<group>/events/<id>/  — a bare /<group>/ is the hub.
  "meetup.com": {
    hub: [/^\/find\//i, /^\/topics\//i, /^\/cities\//i],
    event: [/^\/[^/]+\/events\/\d+/i],
  },
  // https://www.eventbrite.com/e/<slug>-tickets-<id>  — /d/ is a discovery feed.
  "eventbrite.com": {
    hub: [/^\/d\//i, /^\/cc\//i, /^\/o\//i],
    event: [/^\/e\//i],
  },
  // Luma events and calendars share the lu.ma/<slug> shape, so only the
  // unambiguous cases are classified and the rest fall through to `unknown`.
  "lu.ma": {
    hub: [/^\/(discover|explore)(\/|$)/i],
    event: [/^\/event\//i],
  },
  "konfhub.com": {
    hub: [/^\/(explore|search)(\/|$)/i],
  },
  "gdg.community.dev": {
    event: [/\/events\//i],
  },
};

/** Strips a leading `www.` so rules key off the registrable host. */
function normaliseHost(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

export function classifyEventUrl(rawUrl: string): UrlKind {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "unknown";
  }

  const rules = RULES[normaliseHost(url.hostname)];
  if (!rules) return "unknown";

  const path = url.pathname;
  if (rules.hub?.some((re) => re.test(path))) return "hub";
  if (rules.event) return rules.event.some((re) => re.test(path)) ? "event" : "hub";
  return "unknown";
}
