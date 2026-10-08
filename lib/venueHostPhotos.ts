import { query } from '@/lib/db';
import type { CatalogVenue } from '@/lib/venueCatalog';

export const MAX_VENUE_PHOTOS = 30;

/** Reuse poster_uploads, recording the owning venue in its existing provenance
 * field. A host cannot attach another venue's uploads by guessing poster IDs. */
export function hostPhotoOrigin(venueSlug: string): string {
  return `host-venue:${venueSlug}`;
}

export function parseHostPhotos(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_VENUE_PHOTOS ||
      value.some(url => typeof url !== 'string' || !url.trim() || url.length > 2048)) return null;
  const photos = value.map(url => (url as string).trim());
  return new Set(photos).size === photos.length ? photos : null;
}

/** Existing curator-selected photos may be retained/reordered. New photos
 * must have been uploaded through this venue's verified host endpoint. */
export async function canUseHostPhotos(venue: CatalogVenue, photos: string[]): Promise<boolean> {
  const existing = new Set([...venue.photos, ...venue.spaces.map(space => space.image)]);
  const added = photos.filter(url => !existing.has(url));
  if (!added.length) return true;
  const ids = added.map(url => {
    const match = /^\/api\/poster\/([1-9]\d*)$/.exec(url);
    return match ? Number(match[1]) : NaN;
  });
  if (ids.some(id => !Number.isSafeInteger(id) || id > 2147483647)) return false;
  const { rows } = await query<{ id: number }>(
    'SELECT id FROM poster_uploads WHERE id = ANY($1::int[]) AND origin = $2 AND origin_url = $3',
    [ids, 'upload', hostPhotoOrigin(venue.slug)],
  );
  const owned = new Set(rows.map(row => row.id));
  return ids.every(id => owned.has(id));
}
