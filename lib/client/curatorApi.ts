"use client";

import type { CuratorDraft } from "@/lib/curatorDraft";
import type { Category, EventStatus, ExtractedEvent, PriceType } from "@/lib/types";

/**
 * Thin client over /api/admin/*.
 *
 * No credentials are handled here. `/admin/*` and `/api/admin/*` sit behind
 * HTTP Basic enforced in proxy.ts, so the browser has already authenticated to
 * reach this page and attaches the header to these same-origin requests itself.
 * That's why there's no login form and no token in localStorage to leak.
 */

export type QueueKey =
  | "pending"
  | "needs_correction"
  | "duplicates"
  | "published"
  | "expired"
  | "needs_date_review"
  | "rejected"
  | "errors"
  | "in_progress";

export interface QueueItem {
  id: number;
  title: string | null;
  snippet: string | null;
  url: string;
  source_domain: string;
  discovered_at: string;
  status: string;
  rejection_reason: string | null;
  extraction_meta: { sourceMethod?: string; confidence?: number; possibleDuplicate?: unknown } | null;
  curator_draft: CuratorDraft | null;
  origin: "search" | "curator" | "community";
  event_id: number | null;
  query_text: string | null;
  /** Published category when extracted, else the discovering query's hint. */
  category: string | null;
}

export interface AdminEvent {
  id: number;
  title: string;
  category: Category;
  status: EventStatus;
  startAt: string | null;
  endAt: string | null;
  isOnline: boolean;
  venueName: string | null;
  city: string;
  organizerName: string | null;
  posterImageUrl: string | null;
  primarySourceUrl: string;
  summary: string | null;
  sourceType: "auto" | "curator";
  lastVerifiedAt: string | null;
  createdAt: string;
  sourceCount: number;
  openReports: number;
}

export interface DedupMatch {
  id: number;
  title: string;
  start_at: string | null;
  venue_name: string | null;
  is_online: boolean;
  organizer_name: string | null;
  primary_source_url: string;
  status: string;
}

export interface DedupResult {
  outcome: "none" | "low" | "medium" | "high";
  score: number;
  matchedOn?: "url" | "fuzzy";
  match: DedupMatch | null;
}

export interface PreviewResult {
  skippedFetch?: boolean;
  reason?: string;
  extracted: ExtractedEvent | null;
  categorization: { category: Category | null; chennaiRelevanceScore: number } | null;
  /** Mirrors lib/extract.ts ValidationResult — advisory here; the curator can
   *  still publish after fixing the fields by hand. */
  validation?: { valid: boolean; reason?: string } | null;
}

/** Surfaces the server's own error text — a curator debugging a stuck item
 *  needs the real reason, not a generic "Something went wrong". */
export class CuratorApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CuratorApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // non-JSON (e.g. the 401 HTML from proxy.ts) — fall through to status text
  }

  if (!res.ok) {
    const body = payload as { error?: string } | null;
    throw new CuratorApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return payload as T;
}

export interface QueueFacets {
  source: Record<string, number>;
  category: Record<string, number>;
}

export function fetchQueue(
  queue: QueueKey,
  filters: { source?: string | null; category?: string | null } = {},
) {
  const params = new URLSearchParams({ queue });
  if (filters.source) params.set("source", filters.source);
  if (filters.category) params.set("category", filters.category);
  return request<{ items: QueueItem[]; counts: Record<string, number>; facets: QueueFacets }>(
    `/api/admin/curator/queue?${params.toString()}`,
  );
}

export function fetchPublishedEvents(search = "") {
  return request<{ events: AdminEvent[] }>(`/api/admin/events?q=${encodeURIComponent(search)}`);
}

export function runExtraction(discoveryItemId: number) {
  return request<PreviewResult>(`/api/admin/curator/preview?id=${discoveryItemId}`);
}

export function checkDuplicate(input: {
  title: string;
  startAt: string | null;
  isOnline: boolean;
  venueName: string | null;
  organizerName: string | null;
  category: Category;
  url: string;
}) {
  return request<DedupResult>("/api/admin/curator/dedup-check", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function publishEvent(input: {
  discoveryItemId: number;
  title: string;
  summary: string | null;
  category: Category;
  startAt: string | null;
  endAt: string | null;
  isOnline: boolean;
  venueName: string | null;
  venueAddress: string | null;
  organizerName: string | null;
  posterImageUrl: string | null;
  priceType: PriceType | null;
  priceNote: string | null;
  primarySourceUrl: string | null;
  status: EventStatus;
  chennaiRelevanceScore: number;
}) {
  return request<{ status: "created" | "duplicate"; eventId: number }>(
    "/api/admin/curator/approve",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function saveDraft(discoveryItemId: number, draft: CuratorDraft, note?: string) {
  return request<{ status: string }>("/api/admin/curator/save-draft", {
    method: "POST",
    body: JSON.stringify({ discoveryItemId, draft, note }),
  });
}

export function rejectItem(discoveryItemId: number, reason: string) {
  return request<{ status: string }>("/api/admin/curator/reject", {
    method: "POST",
    body: JSON.stringify({ discoveryItemId, reason }),
  });
}

export function setItemStatus(
  discoveryItemId: number,
  action: "irrelevant" | "expired" | "rejected" | "reopen",
  reason?: string,
) {
  return request<{ status: string }>("/api/admin/curator/item-status", {
    method: "POST",
    body: JSON.stringify({ discoveryItemId, action, reason }),
  });
}

export function addCandidate(url: string) {
  return request<{ reused: boolean; discoveryItemId: number; status?: string }>(
    "/api/admin/curator/add",
    { method: "POST", body: JSON.stringify({ url }) },
  );
}

export function setEventStatus(eventId: number, status: EventStatus) {
  return request<{ eventId: number; status: EventStatus }>("/api/admin/events/status", {
    method: "POST",
    body: JSON.stringify({ eventId, status }),
  });
}
