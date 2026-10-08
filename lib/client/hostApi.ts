"use client";

import type { VenueBooking, VenueBookingOrder, VenueReview } from "@/lib/venueBookings";
import type { AdminSpace, AdminVenue } from '@/lib/client/venueAdminApi';
import type { HostSpaceDetails } from '@/lib/venueHostSpaceValidation';

/**
 * Thin client over /api/host/*.
 *
 * `/api/host/*` requires a verified, currently approved host session (or a
 * curator session). The server selects the owning venue.
 */

export class HostApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HostApiError";
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
    // non-JSON (e.g. a redirect to the login page) — fall through to status text
  }
  if (!res.ok) {
    const body = payload as { error?: string } | null;
    throw new HostApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return payload as T;
}

export type HostBooking = VenueBooking & { orderTotal: number };

export function fetchHostVenue() {
  return request<{ ok: true; venue: AdminVenue }>('/api/host/venue');
}

export function updateHostVenuePhotos(photos: string[]) {
  return request<{ ok: true; venue: AdminVenue }>('/api/host/venue', {
    method: 'PATCH', body: JSON.stringify({ photos }),
  });
}

export function updateHostSpacePhoto(rowId: number, image: string) {
  return request<{ ok: true; space: AdminSpace }>(`/api/host/venue/spaces/${rowId}`, {
    method: 'PATCH', body: JSON.stringify({ image }),
  });
}

export function publishHostSpace(details: HostSpaceDetails, target: number | string) {
  return request<{ ok: true; space: AdminSpace }>(typeof target === 'number' ? `/api/host/venue/spaces/${target}` : '/api/host/venue/spaces', {
    method: typeof target === 'number' ? 'PATCH' : 'POST',
    body: JSON.stringify({ ...details, ...(typeof target === 'string' ? { requestId: target } : {}) }),
  });
}

export async function uploadHostVenuePhoto(file: File): Promise<string> {
  const form = new FormData();
  form.set('file', file);
  const res = await fetch('/api/host/venue/photos', { method: 'POST', body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) throw new HostApiError(data?.error ?? 'Upload failed. Please retry.', res.status);
  return data.url as string;
}

export function listHostReviews(): Promise<{ ok: true; reviews: VenueReview[] }> {
  return request('/api/host/reviews');
}

export function listHostBookings(venueSlug?: string): Promise<{ ok: true; bookings: HostBooking[] }> {
  return request(`/api/host/bookings${venueSlug ? `?venueSlug=${encodeURIComponent(venueSlug)}` : ''}`);
}

export function setHostBookingStatus(
  id: number,
  status: "approved" | "declined" | "cancelled",
): Promise<{ ok: true; booking: VenueBooking }> {
  return request(`/api/host/bookings/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
}

export function checkInBooking(identifier: { token: string } | { code: string }): Promise<{ ok: true; booking: VenueBooking }> {
  return request(`/api/host/checkin`, { method: "POST", body: JSON.stringify(identifier) });
}

export function completeHostBooking(id: number): Promise<{ ok: true; booking: VenueBooking }> {
  return request(`/api/host/bookings/${id}/complete`, { method: "POST" });
}

export function addHostOrder(
  id: number,
  description: string,
  amount: number,
): Promise<{ ok: true; order: VenueBookingOrder }> {
  return request(`/api/host/bookings/${id}/orders`, {
    method: "POST",
    body: JSON.stringify({ description, amount }),
  });
}
