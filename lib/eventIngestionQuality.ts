import type { ExtractedEvent } from "./types";
import { ingestionLocationAllowed } from "./eventIngestionScope";
import { eventAddressRegion, normalizeEventCity } from "./eventLocations";

/** Missing facts go to review, not to invented SEO copy. Search location is
 * not evidence. Structured data is preferred; AI-only imports need evidence. */
export function automaticPublicationIssue(event: ExtractedEvent, supportingText: string | null): string | null {
  if (!ingestionLocationAllowed(event)) return "outside_ingestion_region";
  if (!event.startAt || !/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(event.startAt)) return "precise_event_time_required";
  if (!event.summary || event.summary.trim().length < 80) return "insufficient_source_description";
  if (!event.organizerName?.trim()) return "missing_source_organizer";
  if (!event.isOnline && (!event.venueName?.trim() || !event.venueAddress?.trim())) return "missing_source_venue";
  const venueParts = (event.venueName ?? '').split(',').map(part => part.trim()).filter(Boolean);
  const region = eventAddressRegion(event.city ?? '')?.toLowerCase();
  const cityOnlyVenue = venueParts.length > 0
    && normalizeEventCity(venueParts[0]) === normalizeEventCity(event.city)
    && venueParts.slice(1).every(part => part.toLowerCase() === 'india' || part.toLowerCase() === region);
  if (!event.isOnline && (/\[(?:venue|location)[^\]]*\]|\b(?:tba|tbd|to be announced|register to (?:see|view))\b/i.test(`${event.venueName} ${event.venueAddress}`)
    || cityOnlyVenue)) return "source_venue_withheld";
  if (event.sourceMethod === "llm") {
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLocaleLowerCase();
    const page = normalize(supportingText ?? "");
    const evidenceExists = (value: string | null) => !!value && value.trim().length >= 8 && page.includes(normalize(value));
    if (event.confidence < 0.85 || !evidenceExists(event.dateEvidence)
      || (!event.isOnline && !evidenceExists(event.venueEvidence))) return "source_evidence_review";
  }
  return null;
}

export function retryDelayMs(attempt: number): number {
  return Math.min(6 * 3_600_000, 15 * 60_000 * 2 ** Math.max(0, attempt - 1));
}

/** Same safety cap for scheduled CLI and authenticated HTTP triggers. */
export function publicationLimit(override?: number): number {
  const configured = Number(process.env.EVENT_MAX_PUBLISH_PER_RUN ?? 10);
  if (!Number.isInteger(configured) || configured < 0 || configured > 50) throw new Error("EVENT_MAX_PUBLISH_PER_RUN must be 0..50");
  if (override !== undefined && (!Number.isInteger(override) || override < 0 || override > 50)) throw new Error("maxPublish must be 0..50");
  return Math.min(override ?? configured, configured);
}
