export const CATEGORIES = [
  "ai",
  "tech",
  "cybersecurity",
  "marketing",
  "product",
  "design",
  "startups",
  "finance",
  "data",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type TrustTier = "auto_fetch" | "curator_only" | "blocked";

export type DiscoveryItemStatus =
  | "new"
  | "auto_processing"
  | "auto_extracted"
  | "curator_pending"
  | "needs_correction"
  | "curator_approved"
  | "curator_rejected"
  | "rejected"
  | "duplicate"
  | "needs_date_review"
  | "expanded"
  | "expired"
  | "error";

export type EventStatus =
  | "pending_review"
  | "live"
  | "updated"
  | "postponed"
  | "cancelled"
  | "expired";

export type SourceType = "auto" | "curator";

/**
 * Whether attending costs money. `null` (absent) means UNKNOWN and must never
 * be rendered as "Free" — most pages publish no price information at all, and
 * telling someone an event is free when we don't know is exactly the kind of
 * claim this project refuses to make.
 */
export type PriceType = "free" | "paid";

export interface Source {
  id: number;
  domain: string;
  name: string;
  trust_tier: TrustTier;
  robots_allowed: boolean | null;
  robots_checked_at: string | null;
  rate_limit_per_hour: number;
  last_fetched_at: string | null;
  active: boolean;
}

export interface SearchQuery {
  id: number;
  query_text: string;
  category_hint: string | null;
  site_filter: string | null;
  active: boolean;
  last_run_at: string | null;
}

export interface EventRecord {
  id: number;
  title: string;
  summary: string | null;
  category: Category;
  start_at: string | null;
  end_at: string | null;
  is_online: boolean;
  venue_name: string | null;
  venue_address: string | null;
  city: string;
  organizer_name: string | null;
  poster_image_url: string | null;
  price_type: PriceType | null;
  price_note: string | null;
  primary_source_url: string;
  source_type: SourceType;
  chennai_relevance_score: number | null;
  status: EventStatus;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryItem {
  id: number;
  query_id: number | null;
  title: string | null;
  snippet: string | null;
  url: string;
  source_domain: string;
  discovered_at: string;
  status: DiscoveryItemStatus;
  rejection_reason: string | null;
  event_id: number | null;
  origin: "search" | "curator" | "community";
}

export interface EventSourceRecord {
  id: number;
  event_id: number;
  source_url: string;
  source_domain: string;
  discovery_item_id: number | null;
  added_at: string;
}

/** Shared contract for anything that pulls structured event fields out of a page. */
export interface ExtractedEvent {
  title: string;
  summary: string | null;
  startAt: string | null; // ISO 8601, or null if unknown
  endAt: string | null;
  isOnline: boolean;
  venueName: string | null;
  venueAddress: string | null;
  organizerName: string | null;
  posterImageUrl: string | null;
  priceType: PriceType | null; // null = not stated on the page
  priceNote: string | null; // display amount when one was published, e.g. "₹499"
  /** offers.validThrough — when ticket sales close. Null on most listings. */
  registrationDeadline?: string | null;
  sourceMethod: "json_ld" | "llm";
  confidence: number; // 0..1. json_ld extractions are implicitly 1.0 (structured data, not inferred).
  dateEvidence: string | null; // verbatim page-text substring the LLM based startAt/endAt on
  venueEvidence: string | null; // verbatim page-text substring the LLM based venue fields on
}

export interface CategorizationResult {
  category: Category | null; // null = confidently doesn't fit any allowlisted category -> reject
  chennaiRelevanceScore: number; // 0..1
}

export interface PossibleDuplicate {
  eventId: number;
  score: number;
  reason: string;
}

/** Persisted into discovery_items.extraction_meta (JSONB) — diagnostic detail, not workflow state. */
export interface ExtractionMeta {
  sourceMethod: "json_ld" | "llm";
  confidence?: number;
  dateEvidence?: string | null;
  venueEvidence?: string | null;
  possibleDuplicate?: PossibleDuplicate | null;
}

export interface DuplicateMatch {
  eventId: number;
  matchedOn: "url" | "fuzzy";
  score: number;
}
