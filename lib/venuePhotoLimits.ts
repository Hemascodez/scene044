/** Venue and room photos only. Event posters, menu scans, and reviews retain their own limits. */
export const MAX_VENUE_PHOTO_BYTES = 10_000_000;
export const MAX_VENUE_UPLOAD_BODY_BYTES = MAX_VENUE_PHOTO_BYTES + 65_536;
