"use client";

/** Public client for a venue's reviews — no auth, unlike lib/client/venueAdminApi.ts. */

export class VenueReviewApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "VenueReviewApiError";
  }
}

/** Persists photos from the existing post-event review screen for moderation. */
export async function submitVenueReviewWithPhotos(slug: string, input: {
  name: string; eventType: string; workedWell: boolean; aspects: Record<string, boolean | null>; text: string; photos: string[];
}): Promise<void> {
  const form = new FormData();
  const tagsByAspect: Record<string, string> = {
    'Cleanliness of the venue': 'Clean', 'Seating & layout': 'Space', 'AV equipment & Wi-Fi': 'Wifi',
    'Setup & coordination': 'Staff', 'Food & refreshments': 'Food', 'Host team and support': 'Staff',
  };
  form.set('review', JSON.stringify({ reviewerName: input.name, eventType: input.eventType,
    rating: input.workedWell ? 5 : 3, tags: [...new Set(Object.entries(input.aspects).filter(([,yes]) => yes).map(([name]) => tagsByAspect[name]).filter(Boolean))],
    comment: input.text, photoConsent: true }));
  for (const [index, photo] of input.photos.entries()) {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(photo)) throw new Error('Choose JPG, PNG or WebP event photos.');
    const bytes = Uint8Array.from(atob(photo.split(',')[1]), character => character.charCodeAt(0));
    if (bytes.length > 5_000_000) throw new Error('Each event photo must be under 5 MB.');
    form.append('photos', new Blob([bytes], { type: photo.slice(5, photo.indexOf(';')) }), `event-${index}`);
  }
  const response = await fetch(`/api/venues/${encodeURIComponent(slug)}/reviews`, { method: 'POST', body: form });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new VenueReviewApiError(data?.error ?? 'Could not save your review. Please retry.', response.status);
}

export async function submitSelfReportedReview(
  slug: string,
  input: {
    reviewerName: string;
    eventType: string;
    rating: 3 | 4 | 5;
    tags: string[];
    comment: string;
  },
): Promise<void> {
  const res = await fetch(`/api/venues/${slug}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new VenueReviewApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  }
}
