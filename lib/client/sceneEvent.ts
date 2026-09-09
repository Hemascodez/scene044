import type { PublicEvent } from "@/lib/events";
import { stockPosterFor } from "@/lib/stockPosters";
import { isPastEvent } from "@/lib/client/istTime";

/**
 * The status the card actually renders, which is not the same as the database
 * column: expiry is derived from the date (so it's right even when the
 * freshness sweep is behind) and a missing date becomes its own honest state
 * rather than being presented as a confirmed event.
 */
export type SceneStatus = "confirmed" | "cancelled" | "postponed" | "expired" | "uncertain";

export const STATUS_META: Record<SceneStatus, { label: string; tone: "ok" | "warn" | "bad" | "muted" }> = {
  confirmed: { label: "Confirmed", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "bad" },
  postponed: { label: "Postponed", tone: "warn" },
  expired: { label: "Expired", tone: "muted" },
  uncertain: { label: "Date needs confirmation", tone: "warn" },
};

export function deriveSceneStatus(event: PublicEvent, now: Date = new Date()): SceneStatus {
  // Order matters: an organizer cancelling outranks the date having passed,
  // because "Cancelled" is the fact the visitor needs, not "Expired".
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "postponed") return "postponed";
  if (event.status === "expired") return "expired";
  if (!event.startAt) return "uncertain";
  if (isPastEvent(event.startAt, now)) return "expired";
  return "confirmed";
}

/** Hidden from the feed entirely: nothing anyone can still attend. */
export function isHiddenFromFeed(event: PublicEvent, now: Date = new Date()): boolean {
  return deriveSceneStatus(event, now) === "expired";
}

export function bySoonest(a: PublicEvent, b: PublicEvent): number {
  if (a.isPromoted !== b.isPromoted) return a.isPromoted ? -1 : 1;
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
    ...event.tags,
  ]
    .filter((v): v is string => !!v)
    .some((v) => v.toLowerCase().includes(q));
}

export interface EventAudienceTag {
  label: string;
  emoji: string;
}

/** Audience labels are evidence-based: every tag requires an explicit phrase
 * in the title, summary or source-grounded highlights. Category alone is not
 * enough to claim an event is suitable for a particular person. */
export function audienceTagsFor(event: PublicEvent): EventAudienceTag[] {
  const text = [event.title, usableEventSummary(event), ...event.highlights]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const rules: Array<EventAudienceTag & { test: RegExp }> = [
    {
      label: "Beginner friendly",
      emoji: "🌱",
      test: /\bbeginner(?:s|'s)?\b|beginner[- ]friendly|no (?:prior )?experience|no prerequisites?/i,
    },
    { label: "Students", emoji: "🎓", test: /\bstudents?\b|\bundergraduates?\b/i },
    { label: "Professionals", emoji: "💼", test: /\bprofessionals?\b|working professionals?/i },
    { label: "Founders", emoji: "🚀", test: /\bfounders?\b|startup leaders?/i },
    { label: "Developers", emoji: "💻", test: /\bdevelopers?\b|software engineers?/i },
    { label: "Designers", emoji: "🎨", test: /\bdesigners?\b|\bux\b|\bui\b/i },
    { label: "Networking", emoji: "🤝", test: /\bnetworking\b|meet (?:other )?peers|connect with peers/i },
  ];
  const manual = event.tags.map((label) => ({ label, emoji: "" }));
  const derived = rules.filter((rule) => rule.test.test(text)).map(({ label, emoji }) => ({ label, emoji }));
  const seen = new Set<string>();
  return [...manual, ...derived].filter((tag) => {
    const key = tag.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function shortPlainText(value: string, maxLength = 180): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  const candidate = compact.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  const end = lastSpace > maxLength * 0.65 ? lastSpace : candidate.length;
  return `${candidate.slice(0, end).replace(/[\s,.;:—-]+$/g, "")}…`;
}

function summarySentences(summary: string | null): string[] {
  const plain = toPlainSummary(summary);
  if (!plain) return [];
  return (plain.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [plain])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function editionNumbers(value: string): number[] {
  return [...value.matchAll(/(?:#|\bedition\s+)(\d{1,3})\b/gi)].map((match) => Number(match[1]));
}

/**
 * Reject copy that clearly belongs to a different numbered edition.
 *
 * Some recurring-event pages expose the previous edition's anecdote as their
 * JSON-LD description. Showing "#11" on a "#12" page is worse than omitting
 * the description: it looks polished but describes the wrong event.
 */
export function usableEventSummary(event: Pick<PublicEvent, "title" | "summary">): string | null {
  const summary = toPlainSummary(event.summary);
  if (!summary) return null;

  const titleEditions = editionNumbers(event.title);
  const summaryEditions = editionNumbers(summary);
  if (
    titleEditions.length > 0
    && summaryEditions.length > 0
    && summaryEditions.some((edition) => !titleEditions.includes(edition))
  ) {
    return null;
  }

  return summary;
}

/** One concise, plain-text overview sentence. A rhetorical legacy hook is
 * skipped so the useful sentence does the work instead. */
export function eventShortIntro(event: PublicEvent): string | null {
  const sentences = summarySentences(usableEventSummary(event));
  if (sentences.length === 0) return null;
  const useful = sentences[0].endsWith("?") && sentences.length > 1 ? sentences[1] : sentences[0];
  return shortPlainText(useful, 220);
}

/** Prefer the three source-grounded highlights. Older listings without them
 * simply omit the numbered outcomes rather than turning descriptive prose
 * into a promise the source never made. */
export function actionizeEventHighlight(value: string): string {
  const clean = shortPlainText(value, 90).replace(/[.!?]+$/g, "");
  if (!clean) return "";
  if (/^(learn|hear|ask|meet|build|practise|practice|understand|compare|discover|explore|see|try|discuss|get|gain)\b/i.test(clean)) {
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  const session = clean.match(/^sessions?\s+(?:on|about|covering)\s+(.+)$/i);
  if (session) return `Learn about ${session[1]}`;
  const panel = clean.match(/^panels?\s+(?:on|about|covering)\s+(.+)$/i);
  if (panel) return `Hear perspectives on ${panel[1]}`;
  const questions = clean.match(/^q\s*&\s*a(?:\s+(?:on|about)\s+(.+)|\s+with\s+(.+))?$/i);
  if (questions?.[1]) return `Ask questions about ${questions[1]}`;
  if (questions) return "Ask questions in the technical Q&A";
  const talk = clean.match(/^talks?\s+(?:on|about|covering)\s+(.+)$/i);
  if (talk) return `Hear talks about ${talk[1]}`;
  const founderTalk = clean.match(/^founder\s+talks?$/i);
  if (founderTalk) return "Hear directly from founders";
  const workshop = clean.match(/^workshops?\s+(?:on|about|covering)\s+(.+)$/i);
  if (workshop) return `Practise ${workshop[1]} in a workshop`;
  if (/^networking\b/i.test(clean)) return "Meet peers and build connections";

  return `Explore ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
}

export function eventSummaryBullets(event: PublicEvent): string[] {
  return event.highlights.map(actionizeEventHighlight).filter(Boolean).slice(0, 3);
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

/**
 * Minimal inline Markdown for the event write-up.
 *
 * The copy comes back as Markdown, but pulling in a parser for what is
 * realistically bold and paragraph breaks would be the fifth runtime
 * dependency in a project that has four. Everything except **bold** is already
 * flattened by toPlainSummary, and React escapes each segment as text, so
 * there is no HTML to inject.
 */
export interface StorySegment {
  text: string;
  bold: boolean;
}

export function toStoryParagraphs(markdown: string | null): StorySegment[][] {
  const plain = markdown
    ?.replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/`([^`]*)`/g, "$1")
    .trim();
  if (!plain) return [];

  return plain
    .split(/\n\s*\n/)
    .map((para) => para.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((para) =>
      para
        .split(/(\*\*[^*]+\*\*)/g)
        .filter(Boolean)
        .map((chunk) =>
          chunk.startsWith("**") && chunk.endsWith("**")
            ? { text: chunk.slice(2, -2), bold: true }
            : { text: chunk, bold: false },
        ),
    );
}
