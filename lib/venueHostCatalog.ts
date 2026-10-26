import { query } from './db';
import { getCatalogVenue } from './venueCatalog';
import { parseSpacePricing } from './venuePricing';

/** Call only after host authorization. Raw host rates/config never enter the
 * public venue DTO; this lets the owning host edit packages without changing fees. */
export async function getHostCatalogVenue(slug: string) {
  const venue = await getCatalogVenue(slug);
  if (!venue) return null;
  const { rows } = await query<{ id: number; pricing_options: unknown }>('SELECT s.id,s.pricing_options FROM venue_spaces s JOIN venues v ON v.id=s.venue_id WHERE v.slug=$1 AND s.retired_at IS NULL', [slug]);
  const configs = new Map(rows.map(row => [row.id, parseSpacePricing(row.pricing_options)]));
  return { ...venue, spaces: venue.spaces.map(space => ({ ...space, pricingConfig: configs.get(space.rowId) ?? null })) };
}
