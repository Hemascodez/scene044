/**
 * Pure constants shared by client components and the server-only
 * lib/venueBookings.ts. Kept in their own file with no `pg`/`query` import so a
 * client component (e.g. SelfReviewForm.tsx) can pull in REVIEW_TAGS without
 * dragging the database driver into the browser bundle.
 */

/** Aspect chips a reviewer can attribute their rating to. */
export const REVIEW_TAGS = ["Wifi", "Food", "Clean", "Vibe", "Space", "Location", "Staff", "Noise"] as const;
export type ReviewTag = (typeof REVIEW_TAGS)[number];
