"use client";

import type { VenueBooking, VenueBookingOrder } from "@/lib/venueBookings";

/**
 * Thin client over /api/host/*.
 *
 * Same trust boundary as lib/client/venueAdminApi.ts: `/api/host/*` sits
 * behind proxy.ts's curator-session gate, so nothing here handles
 * credentials directly.
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

export function listHostBookings(venueSlug = "time-cafe"): Promise<{ ok: true; bookings: HostBooking[] }> {
  return request(`/api/host/bookings?venueSlug=${encodeURIComponent(venueSlug)}`);
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
