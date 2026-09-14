"use client";

import type { PartnerRequestStatus, VenueEarnings } from "@/lib/venueCatalog";
import type { VenueStatus } from "@/lib/venues";

/**
 * Thin client over /api/admin/venues* and /api/admin/venue-partners*.
 *
 * Same trust boundary as lib/client/curatorApi.ts: `/api/admin/*` sits behind
 * proxy.ts's HTTP Basic gate, so nothing here handles credentials directly.
 */

export class VenueAdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "VenueAdminApiError";
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
    throw new VenueAdminApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return payload as T;
}

export interface AdminSpace {
  rowId: number;
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  capacity: string;
  maxGuests: number;
  image: string;
  amenities: string[];
  communityRate: number | null;
  productionRate: number | null;
  minimumFoodSpend: number | null;
  sortOrder: number;
}

export interface AdminVenue {
  id: number;
  slug: string;
  name: string;
  area: string;
  city: string;
  address: string | null;
  summary: string;
  status: VenueStatus | "hidden";
  rating: number | null;
  ratingCount: number | null;
  ratingUrl: string | null;
  phone: string | null;
  mapUrl: string | null;
  mapEmbedUrl: string | null;
  photos: string[];
  amenities: string[];
  policies: string[];
  spaces: AdminSpace[];
}

export function fetchVenues() {
  return request<{ venues: AdminVenue[] }>("/api/admin/venues");
}

export function createVenueDraft(input: { name: string; area: string }) {
  return request<{ venue: AdminVenue }>("/api/admin/venues", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateVenueFields(slug: string, fields: Record<string, unknown>) {
  return request<{ venue: AdminVenue }>(`/api/admin/venues/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export function deleteVenueBySlug(slug: string) {
  return request<{ ok: true }>(`/api/admin/venues/${slug}`, { method: "DELETE" });
}

export function saveVenueSpace(slug: string, space: Record<string, unknown>) {
  return request<{ space: AdminSpace }>(`/api/admin/venues/${slug}/spaces`, {
    method: "POST",
    body: JSON.stringify(space),
  });
}

export function deleteVenueSpaceByRowId(slug: string, rowId: number) {
  return request<{ ok: true }>(`/api/admin/venues/${slug}/spaces/${rowId}`, { method: "DELETE" });
}

export interface AdminPartnerRequest {
  id: number;
  contactName: string;
  phone: string;
  venueName: string;
  area: string;
  link: string | null;
  details: string;
  status: PartnerRequestStatus;
  curatorNote: string | null;
  createdAt: string;
}

export function fetchPartnerRequests(status?: PartnerRequestStatus) {
  const params = status ? `?status=${status}` : "";
  return request<{ requests: AdminPartnerRequest[] }>(`/api/admin/venue-partners${params}`);
}

export function updatePartnerRequest(id: number, status: PartnerRequestStatus, note?: string) {
  return request<{ request: AdminPartnerRequest }>(`/api/admin/venue-partners/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });
}

/**
 * Uploads a venue photo through the existing curator poster pipeline
 * (app/api/admin/curator/poster) — it's already a generic "verify magic bytes,
 * store in poster_uploads, hand back /api/poster/{id}" endpoint with no
 * dependency on events, so venue photos reuse it rather than a second upload
 * path and a second storage table.
 */
export async function uploadVenuePhoto(file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/admin/curator/poster", { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) {
    throw new VenueAdminApiError(data?.error ?? "Upload failed", res.status);
  }
  return data.url as string;
}

export function fetchVenueEarnings(venueSlug?: string) {
  const params = venueSlug ? `?venue=${encodeURIComponent(venueSlug)}` : "";
  return request<{ earnings: VenueEarnings }>(`/api/admin/venue-earnings${params}`);
}

export interface AdminVenueReview {
  id: number;
  bookingId: number | null;
  venueSlug: string;
  rating: number;
  tags: string[];
  comment: string | null;
  source: "booking" | "self_reported";
  status: "pending" | "published" | "rejected";
  createdAt: string;
  organizerName?: string;
  eventType?: string;
}

export function fetchPendingVenueReviews() {
  return request<{ reviews: AdminVenueReview[] }>("/api/admin/venue-reviews");
}

export function setVenueReviewStatus(id: number, status: "published" | "rejected") {
  return request<{ review: AdminVenueReview }>(`/api/admin/venue-reviews/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
