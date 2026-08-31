import { query } from "@/lib/db";
import { normalizeUrl } from "@/lib/domain";
import type { Category, DuplicateMatch } from "@/lib/types";

// Provisional/tunable — watch real data for a few days before adjusting.
export const DEDUP_HIGH_CONFIDENCE_THRESHOLD = 0.8;
export const DEDUP_LOW_CONFIDENCE_THRESHOLD = 0.55;
export const DEDUP_WEIGHTS = {
  title: 0.45,
  date: 0.25,
  venue: 0.15,
  organizer: 0.1,
  url: 0.05,
} as const;

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "at", "for", "to", "and", "on", "with", "by",
]);
// Nearly every title in this corpus contains these — leaving them in would let
// two unrelated Chennai events inflate title similarity on generic wording alone.
const DOMAIN_NOISE = new Set([
  "chennai", "meetup", "meet", "event", "events", "conference", "summit",
  "2025", "2026",
]);

function normalizeTitle(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input: string | null | undefined): string[] {
  return normalizeTitle(input)
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t) && !DOMAIN_NOISE.has(t));
}

function dice(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let intersection = 0;
  for (const t of sa) if (sb.has(t)) intersection++;
  return (2 * intersection) / (sa.size + sb.size);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev = curr;
  }
  return prev[b.length];
}

function editSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function titleSimilarity(a: string, b: string): number {
  const diceScore = dice(tokenize(a), tokenize(b));
  const editScore = editSimilarity(normalizeTitle(a), normalizeTitle(b));
  return 0.7 * diceScore + 0.3 * editScore;
}

function fieldSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0; // absent data is not a signal either way; weight handles this
  return editSimilarity(normalizeTitle(a), normalizeTitle(b));
}

function dateScore(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const diffHours =
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000;
  if (!Number.isFinite(diffHours)) return 0;
  return Math.max(0, 1 - diffHours / 72);
}

function venueScore(
  aOnline: boolean,
  aVenue: string | null,
  bOnline: boolean,
  bVenue: string | null,
): number {
  if (aOnline && bOnline) return 1;
  if (aOnline !== bOnline) return 0; // modality mismatch is a real signal
  return fieldSimilarity(aVenue, bVenue);
}

function urlScore(a: string, bPrimary: string, bSources: string[]): number {
  const normalizedA = normalizeUrl(a);
  if (normalizedA === bPrimary || bSources.includes(normalizedA)) return 1;
  try {
    const hostA = new URL(normalizedA).hostname;
    const hostB = new URL(bPrimary).hostname;
    if (hostA === hostB) return 0.3;
  } catch {
    // ignore malformed URLs, fall through to 0
  }
  return 0;
}

export interface DedupCandidate {
  title: string;
  startAt: string | null;
  isOnline: boolean;
  venueName: string | null;
  organizerName: string | null;
  category: Category;
  url: string;
}

interface CandidateRow {
  id: number;
  title: string;
  start_at: string | null;
  is_online: boolean;
  venue_name: string | null;
  organizer_name: string | null;
  primary_source_url: string;
}

/**
 * Two-stage lookup: an exact normalized-URL match short-circuits to score 1.0
 * (no value in running the weighted formula against an unambiguous match).
 * Otherwise scores a date-windowed, category-filtered candidate pool and
 * returns the best match, whatever its score — callers decide the three-way
 * disposition (merge / needs review / new event) against the exported
 * thresholds above.
 */
export async function findDuplicateEvent(
  candidate: DedupCandidate,
): Promise<DuplicateMatch | null> {
  const normalizedUrl = normalizeUrl(candidate.url);

  const { rows: urlMatches } = await query<{ id: number }>(
    `SELECT e.id FROM events e
     WHERE e.status IN ('live', 'updated', 'pending_review')
       AND (e.primary_source_url = $1
            OR EXISTS (SELECT 1 FROM event_sources es WHERE es.event_id = e.id AND es.source_url = $1))
     LIMIT 1`,
    [normalizedUrl],
  );
  if (urlMatches.length > 0) {
    return { eventId: urlMatches[0].id, matchedOn: "url", score: 1 };
  }

  const dateFrom = candidate.startAt
    ? new Date(new Date(candidate.startAt).getTime() - 3 * 86_400_000).toISOString()
    : null;
  const dateTo = candidate.startAt
    ? new Date(new Date(candidate.startAt).getTime() + 3 * 86_400_000).toISOString()
    : null;

  const { rows: candidates } = await query<CandidateRow>(
    `SELECT id, title, start_at, is_online, venue_name, organizer_name, primary_source_url
     FROM events
     WHERE status IN ('live', 'updated', 'pending_review')
       AND category = $1
       AND ($2::timestamptz IS NULL OR start_at IS NULL OR start_at BETWEEN $2 AND $3)
     ORDER BY created_at DESC
     LIMIT 200`,
    [candidate.category, dateFrom, dateTo],
  );

  let best: DuplicateMatch | null = null;
  for (const row of candidates) {
    const { rows: sourceRows } = await query<{ source_url: string }>(
      "SELECT source_url FROM event_sources WHERE event_id = $1",
      [row.id],
    );
    const score =
      DEDUP_WEIGHTS.title * titleSimilarity(candidate.title, row.title) +
      DEDUP_WEIGHTS.date * dateScore(candidate.startAt, row.start_at) +
      DEDUP_WEIGHTS.venue *
        venueScore(candidate.isOnline, candidate.venueName, row.is_online, row.venue_name) +
      DEDUP_WEIGHTS.organizer * fieldSimilarity(candidate.organizerName, row.organizer_name) +
      DEDUP_WEIGHTS.url *
        urlScore(
          candidate.url,
          row.primary_source_url,
          sourceRows.map((s) => s.source_url),
        );

    if (!best || score > best.score) {
      best = { eventId: row.id, matchedOn: "fuzzy", score };
    }
  }
  return best;
}
