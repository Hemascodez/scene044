import type { PublicEvent } from "@/lib/events";
import { stockPosterFor } from "@/lib/stockPosters";
import { isPastEvent } from "@/lib/client/istTime";

/**
 * The status the card actually renders, which is not the same as the database
 * column: expiry is derived from the date (so it's right even when the
 * freshness sweep is behind) and a missing date becomes its own honest state
 * rather than being presented as a confirmed event.
 */
export type SceneStatus = "confirmed" | "cancelled" | "postponed" | "stale" | "expired" | "uncertain";

export const STATUS_META: Record<SceneStatus, { label: string; tone: "ok" | "warn" | "bad" | "muted" }> = {
  confirmed: { label: "Confirmed", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "bad" },
  postponed: { label: "Postponed", tone: "warn" },
  stale: { label: "May be outdated", tone: "warn" },
  expired: { label: "Expired", tone: "muted" },
  uncertain: { label: "Date needs confirmation", tone: "warn" },
};

export function deriveSceneStatus(event: PublicEvent, now: Date = new Date()): SceneStatus {
  // Order matters: an organizer cancelling outranks the date having passed,
  // because "Cancelled" is the fact the visitor needs, not "Expired".
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "postponed") return "postponed";
  if (!event.startAt) return "uncertain";
  if (isPastEvent(event.startAt, now)) return "expired";
  if (event.status === "stale") return "stale";
  return "confirmed";
}

/** Hidden from the feed entirely: nothing anyone can still attend. */
export function isHiddenFromFeed(event: PublicEvent, now: Date = new Date()): boolean {
  return deriveSceneStatus(event, now) === "expired";
}

export function bySoonest(a: PublicEvent, b: PublicEvent): number {
  // Undated events sort last rather than to 1970.
  const at = a.startAt ? Date.parse(a.startAt) : Number.POSITIVE_INFINITY;
  const bt = b.startAt ? Date.parse(b.startAt) : Number.POSITIVE_INFINITY;
  return at - bt || a.id - b.id;
}

export function matchesSearch(event: PublicEvent, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  return [
    event.title,
    event.organizerName,
    event.venueName,
    event.summary,
    event.primarySourceDomain,
  ]
    .filter((v): v is string => !!v)
    .some((v) => v.toLowerCase().includes(q));
}

export interface ScenePoster {
  src: string;
  /** True when this is category stock artwork, not the organizer's own poster. */
  isStock: boolean;
}

/**
 * Real poster if the source published one, otherwise topical local stock.
 *
 * `isStock` is surfaced so the card can label it. Presenting stock artwork as
 * though it were the organizer's official poster would undercut the whole
 * "we tell you exactly what we know" premise of the trust layer.
 */
export function posterFor(event: PublicEvent): ScenePoster {
  if (event.posterImageUrl) return { src: event.posterImageUrl, isStock: false };
  return { src: stockPosterFor(event.category, event.id), isStock: true };
}

/** Freshly pulled into the index — drives the "New" flag. */
const NEWLY_DISCOVERED_HOURS = 72;

export function isNewlyDiscovered(event: PublicEvent, now: Date = new Date()): boolean {
  return (now.getTime() - Date.parse(event.discoveredAt)) / 3_600_000 <= NEWLY_DISCOVERED_HOURS;
}

/**
 * Scraped summaries arrive as Markdown (meetup.com ships `**bold**`,
 * `[text](url)`, bullet lists and emoji headings). Rendered raw they show
 * their own syntax; rendered as HTML they'd be an injection vector, since this
 * text comes from a third-party page we don't control.
 *
 * So: strip to plain text and print it as a text node. Never dangerouslySetInnerHTML.
 */
export function toPlainSummary(markdown: string | null): string | null {
  if (!markdown) return null;
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> label
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^\s{0,3}[*+-]\s+/gm, "· ") // bullets
    .replace(/^\s{0,3}>\s?/gm, "") // blockquotes
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/^\s*[-*_]{3,}\s*$/gm, " ") // rules
    .replace(/\s*\n\s*\n\s*/g, "\n") // collapse blank lines
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return text.length > 0 ? text : null;
}
