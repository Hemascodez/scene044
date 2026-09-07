import type * as cheerio from "cheerio";

/**
 * Event-date reasoning, shared by discovery, extraction, the public feed and
 * the cleanup job so they can never disagree about what "past" means.
 *
 * The distinction that matters throughout: we care about when the EVENT
 * happens, never when the page was published. An event in September announced
 * in June is perfectly valid; a page published yesterday for an event that
 * happened in August is not.
 */

/**
 * How long after an event ends it stops being shown.
 *
 * Generous enough that someone checking the feed on the evening of an event
 * still sees it, tight enough that yesterday's meetup is gone by morning.
 */
export const EVENT_END_GRACE_MS = 12 * 60 * 60 * 1000;

/**
 * Assumed run time when a listing publishes a start but no end — most don't.
 * Deliberately long: expiring a still-running all-day conference at lunchtime
 * is a worse error than carrying a finished evening meetup a few hours extra.
 */
export const ASSUMED_DURATION_MS = 6 * 60 * 60 * 1000;

/** When an event is actually over, from whatever the source published. */
export function effectiveEndAt(startAt: string | null, endAt: string | null): number | null {
  const end = endAt ? Date.parse(endAt) : NaN;
  if (Number.isFinite(end)) return end;
  const start = startAt ? Date.parse(startAt) : NaN;
  return Number.isFinite(start) ? start + ASSUMED_DURATION_MS : null;
}

/** True only when we KNOW it is over. An unknown date is never "past" — that
 *  distinction is what separates rejection from `needs_date_review`. */
export function isPastEvent(
  startAt: string | null,
  endAt: string | null,
  now: number = Date.now(),
): boolean {
  const end = effectiveEndAt(startAt, endAt);
  return end !== null && end + EVENT_END_GRACE_MS < now;
}

export interface CheapDate {
  startAt: string | null;
  endAt: string | null;
  /** Where it came from, for the curator and for debugging a bad rejection. */
  source: "json_ld" | "meta" | "none";
}

function firstParsableDate(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

/**
 * A date read straight out of the page, with no model call.
 *
 * This is the whole point of the pre-flight gate: parsing JSON-LD and a
 * handful of meta tags is free, so a page advertising a date that has already
 * passed can be thrown away before it costs an extraction, a categorisation
 * and a summarisation call.
 */
export function findCheapEventDate($: cheerio.CheerioAPI): CheapDate {
  // 1. JSON-LD — authoritative when present, whatever the node nesting.
  const starts: unknown[] = [];
  const ends: unknown[] = [];
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(el).text();
    if (!raw.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const visit = (node: unknown, depth: number) => {
      if (!node || typeof node !== "object" || depth > 6) return;
      if (Array.isArray(node)) return node.forEach((n) => visit(n, depth + 1));
      const rec = node as Record<string, unknown>;
      if (rec.startDate) starts.push(rec.startDate);
      if (rec.endDate) ends.push(rec.endDate);
      visit(rec["@graph"], depth + 1);
      visit(rec.itemListElement, depth + 1);
      visit(rec.item, depth + 1);
    };
    visit(parsed, 0);
  }
  const ldStart = firstParsableDate(starts);
  if (ldStart) return { startAt: ldStart, endAt: firstParsableDate(ends), source: "json_ld" };

  // 2. Meta tags. Note these are only trusted for the EVENT date — article
  //    published/modified times are deliberately excluded, since a page
  //    published last week can advertise an event that already happened.
  const metaStart = firstParsableDate([
    $('meta[property="event:start_time"]').attr("content"),
    $('meta[name="event:start_time"]').attr("content"),
    $('meta[itemprop="startDate"]').attr("content"),
    $("time[itemprop='startDate']").attr("datetime"),
  ]);
  if (metaStart) {
    const metaEnd = firstParsableDate([
      $('meta[property="event:end_time"]').attr("content"),
      $('meta[itemprop="endDate"]').attr("content"),
      $("time[itemprop='endDate']").attr("datetime"),
    ]);
    return { startAt: metaStart, endAt: metaEnd, source: "meta" };
  }

  return { startAt: null, endAt: null, source: "none" };
}

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

/**
 * Dates mentioned in a search-result snippet, before we have spent even one
 * HTTP request.
 *
 * Used ONLY to reject, and only when every date found is in the past — a
 * snippet routinely mentions an unrelated date ("posted 12 Aug") alongside the
 * real one, so a single past date proves nothing. Requiring an explicit year
 * keeps "Sep 12" from being guessed into the wrong one.
 */
export function datesInSnippet(text: string): number[] {
  if (!text) return [];
  const found: number[] = [];
  const patterns = [
    new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"),
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS}),?\\s+(\\d{4})\\b`, "gi"),
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const parsed = Date.parse(match[0].replace(/(\d)(st|nd|rd|th)/gi, "$1"));
      if (Number.isFinite(parsed)) found.push(parsed);
    }
  }
  return found;
}

/**
 * True when a snippet mentions dates and ALL of them are already past.
 *
 * Conservative by construction: no dates at all returns false, and one future
 * date anywhere keeps the candidate. A wrong rejection here is invisible and
 * permanent, so the bar is deliberately high.
 */
/**
 * Search engines (and Firecrawl, which mirrors this convention) prepend an
 * "indexed on" or "posted on" date to a snippet — "19 Apr 2026 · Workshop &
 * National Cyber Security Conference..." — which is metadata ABOUT the search
 * result, not content authored by the page. It is indistinguishable in shape
 * from a real date, and LinkedIn results hit this constantly: the post's own
 * timestamp is always in the past by the time it is indexed, so every
 * LinkedIn snippet looked like a past event regardless of when the event it
 * describes actually is. Confirmed against real rejections: two genuinely
 * upcoming 2026 events were rejected on nothing but this leading prefix, with
 * no other date anywhere in the visible snippet text.
 */
const SNIPPET_METADATA_PREFIX =
  /^\s*\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\s*[·\-–—]\s*/i;

export function snippetLooksPast(text: string, now: number = Date.now()): boolean {
  const dates = datesInSnippet(text.replace(SNIPPET_METADATA_PREFIX, ""));
  if (dates.length === 0) return false;
  const cutoff = now - EVENT_END_GRACE_MS;
  return dates.every((d) => d + ASSUMED_DURATION_MS < cutoff);
}
