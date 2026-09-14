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
