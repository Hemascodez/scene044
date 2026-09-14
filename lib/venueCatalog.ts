import { query } from "@/lib/db";
import type { VenueSpace, VenueStatus } from "@/lib/venues";

/**
 * The venue catalog, read from and written to the database.
 *
 * Venue content used to be a hardcoded constant in lib/venues.ts, which meant
 * adding a cafe or fixing a rate was a deploy. The curator now owns this data,
 * so it lives here; lib/venues.ts keeps the shared types and the pricing rules
 * (rateForSpace/venueFromRate), which apply the same either way.
 */

export interface CatalogVenue {
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
  spaces: CatalogSpace[];
}

export interface CatalogSpace extends VenueSpace {
  /** Database row id, so the curator can edit a specific room. */
  rowId: number;
  sortOrder: number;
}

const VENUE_COLUMNS = `
  id, slug, name, area, city, address, summary, status,
  rating, rating_count AS "ratingCount", rating_url AS "ratingUrl",
  phone, map_url AS "mapUrl", map_embed_url AS "mapEmbedUrl",
  photos, amenities, policies
`;

type VenueRow = Omit<CatalogVenue, "spaces" | "rating"> & { rating: string | number | null };

interface SpaceRow {
  rowId: number;
  venueId: number;
  spaceKey: string;
  name: string;
  eyebrow: string;
  description: string;
  capacity: string;
  maxGuests: number;
  image: string | null;
  amenities: string[];
  communityRate: number | null;
  productionRate: number | null;
  minimumFoodSpend: number | null;
  sortOrder: number;
}

const SPACE_COLUMNS = `
  id AS "rowId", venue_id AS "venueId", space_key AS "spaceKey", name, eyebrow, description,
  capacity, max_guests AS "maxGuests", image, amenities,
  community_rate AS "communityRate", production_rate AS "productionRate",
  minimum_food_spend AS "minimumFoodSpend", sort_order AS "sortOrder"
`;

function toSpace(row: SpaceRow): CatalogSpace {
  return {
    // `id` carries the stable key the booking flow and URLs use; `rowId` is the
    // database identity the curator edits against.
    id: row.spaceKey as VenueSpace["id"],
    rowId: row.rowId,
    name: row.name,
    eyebrow: row.eyebrow,
    description: row.description,
    capacity: row.capacity,
    maxGuests: row.maxGuests,
    image: row.image ?? "",
    amenities: row.amenities,
    communityRate: row.communityRate,
    productionRate: row.productionRate,
    minimumFoodSpend: row.minimumFoodSpend,
    sortOrder: row.sortOrder,
  };
}

function toVenue(row: VenueRow, spaces: CatalogSpace[]): CatalogVenue {
  return {
    ...row,
    // NUMERIC comes back from pg as a string; the UI formats a number.
    rating: row.rating === null ? null : Number(row.rating),
    spaces,
  };
}

async function attachSpaces(rows: VenueRow[]): Promise<CatalogVenue[]> {
  if (rows.length === 0) return [];
  const { rows: spaceRows } = await query<SpaceRow>(
    `SELECT ${SPACE_COLUMNS} FROM venue_spaces
      WHERE venue_id = ANY($1::int[])
      ORDER BY sort_order, id`,
    [rows.map((row) => row.id)],
  );
  const byVenue = new Map<number, CatalogSpace[]>();
  for (const row of spaceRows) {
    const list = byVenue.get(row.venueId) ?? [];
    list.push(toSpace(row));
    byVenue.set(row.venueId, list);
  }
  return rows.map((row) => toVenue(row, byVenue.get(row.id) ?? []));
}

/** Everything the curator manages, drafts included. */
export async function listAllVenues(): Promise<CatalogVenue[]> {
  const { rows } = await query<VenueRow>(
    `SELECT ${VENUE_COLUMNS} FROM venues ORDER BY status, name`,
  );
  return attachSpaces(rows);
}

/** What the public site shows: live venues plus "launching soon" teasers.
 *  `hidden` drafts are excluded, so a half-filled venue is never public. */
export async function listPublicVenues(): Promise<CatalogVenue[]> {
  const { rows } = await query<VenueRow>(
    `SELECT ${VENUE_COLUMNS} FROM venues
      WHERE status IN ('live','coming-soon')
      ORDER BY CASE status WHEN 'live' THEN 0 ELSE 1 END, name`,
  );
  return attachSpaces(rows);
}

export async function getCatalogVenue(slug: string): Promise<CatalogVenue | null> {
  const { rows } = await query<VenueRow>(
    `SELECT ${VENUE_COLUMNS} FROM venues WHERE slug = $1`,
    [slug],
  );
  const [venue] = await attachSpaces(rows);
  return venue ?? null;
}

export type VenueWritableFields = Partial<{
  name: string;
  area: string;
  city: string;
  address: string | null;
  summary: string;
  status: "live" | "coming-soon" | "hidden";
  rating: number | null;
  ratingCount: number | null;
  ratingUrl: string | null;
  phone: string | null;
  mapUrl: string | null;
  mapEmbedUrl: string | null;
  photos: string[];
  amenities: string[];
  policies: string[];
}>;

/** Maps the API's camelCase field names onto columns. An allowlist rather than
 *  interpolation, so an unexpected key can never reach the SQL. */
const VENUE_COLUMN_MAP: Record<keyof VenueWritableFields, string> = {
  name: "name",
  area: "area",
  city: "city",
  address: "address",
  summary: "summary",
  status: "status",
  rating: "rating",
  ratingCount: "rating_count",
  ratingUrl: "rating_url",
  phone: "phone",
  mapUrl: "map_url",
  mapEmbedUrl: "map_embed_url",
  photos: "photos",
  amenities: "amenities",
  policies: "policies",
};

export async function createVenue(input: { slug: string } & VenueWritableFields): Promise<CatalogVenue> {
  const { rows } = await query<VenueRow>(
    `INSERT INTO venues (slug, name, area, city, summary, status)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${VENUE_COLUMNS}`,
    [
      input.slug,
      input.name ?? input.slug,
      input.area ?? "",
      input.city ?? "Chennai",
      input.summary ?? "",
      // New venues start hidden so a half-entered listing is never public.
      input.status ?? "hidden",
    ],
  );
  return toVenue(rows[0], []);
}

export async function updateVenue(
  slug: string,
  fields: VenueWritableFields,
): Promise<CatalogVenue | null> {
  const entries = Object.entries(fields).filter(([key]) => key in VENUE_COLUMN_MAP);
  if (entries.length === 0) return getCatalogVenue(slug);

  const sets = entries.map(([key], index) => `${VENUE_COLUMN_MAP[key as keyof VenueWritableFields]} = $${index + 2}`);
  const { rows } = await query<VenueRow>(
    `UPDATE venues SET ${sets.join(", ")}, updated_at = now()
      WHERE slug = $1
      RETURNING ${VENUE_COLUMNS}`,
    [slug, ...entries.map(([, value]) => value)],
  );
  if (!rows[0]) return null;
  const [venue] = await attachSpaces(rows);
  return venue;
}

export async function deleteVenue(slug: string): Promise<boolean> {
  const { rowCount } = await query("DELETE FROM venues WHERE slug = $1", [slug]);
  return (rowCount ?? 0) > 0;
}

export interface SpaceInput {
  spaceKey: string;
  name: string;
  eyebrow?: string;
  description?: string;
  capacity?: string;
  maxGuests: number;
  image?: string | null;
  amenities?: string[];
  communityRate?: number | null;
  productionRate?: number | null;
  minimumFoodSpend?: number | null;
  sortOrder?: number;
}

/** Upsert on (venue, space_key) so the curator can re-save a room without
 *  creating duplicates, and so seeding is idempotent. */
export async function upsertVenueSpace(venueId: number, input: SpaceInput): Promise<CatalogSpace> {
  const { rows } = await query<SpaceRow>(
    `INSERT INTO venue_spaces
       (venue_id, space_key, name, eyebrow, description, capacity, max_guests, image,
        amenities, community_rate, production_rate, minimum_food_spend, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (venue_id, space_key) DO UPDATE SET
       name = EXCLUDED.name,
       eyebrow = EXCLUDED.eyebrow,
       description = EXCLUDED.description,
       capacity = EXCLUDED.capacity,
       max_guests = EXCLUDED.max_guests,
       image = EXCLUDED.image,
       amenities = EXCLUDED.amenities,
       community_rate = EXCLUDED.community_rate,
       production_rate = EXCLUDED.production_rate,
       minimum_food_spend = EXCLUDED.minimum_food_spend,
       sort_order = EXCLUDED.sort_order,
       updated_at = now()
     RETURNING ${SPACE_COLUMNS}`,
    [
      venueId,
      input.spaceKey,
      input.name,
      input.eyebrow ?? "",
      input.description ?? "",
      input.capacity ?? "",
      input.maxGuests,
      input.image ?? null,
      input.amenities ?? [],
      input.communityRate ?? null,
      input.productionRate ?? null,
      input.minimumFoodSpend ?? null,
      input.sortOrder ?? 0,
    ],
  );
  return toSpace(rows[0]);
}

export async function deleteVenueSpace(rowId: number): Promise<boolean> {
  const { rowCount } = await query("DELETE FROM venue_spaces WHERE id = $1", [rowId]);
  return (rowCount ?? 0) > 0;
}

// ------------------------------------------------------- partner requests

export type PartnerRequestStatus = "new" | "contacted" | "onboarding" | "listed" | "declined";

export interface PartnerRequest {
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

const PARTNER_COLUMNS = `
  id, contact_name AS "contactName", phone, venue_name AS "venueName", area, link, details,
  status, curator_note AS "curatorNote", created_at AS "createdAt"
`;

export async function createPartnerRequest(input: {
  contactName: string;
  phone: string;
  venueName: string;
  area: string;
  link?: string | null;
  details: string;
}): Promise<PartnerRequest> {
  const { rows } = await query<PartnerRequest>(
    `INSERT INTO venue_partner_requests (contact_name, phone, venue_name, area, link, details)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${PARTNER_COLUMNS}`,
    [input.contactName, input.phone, input.venueName, input.area, input.link ?? null, input.details],
  );
  return rows[0];
}

export async function listPartnerRequests(status?: PartnerRequestStatus): Promise<PartnerRequest[]> {
  const { rows } = await query<PartnerRequest>(
    `SELECT ${PARTNER_COLUMNS} FROM venue_partner_requests
      WHERE ($1::text IS NULL OR status = $1)
      ORDER BY created_at DESC
      LIMIT 200`,
    [status ?? null],
  );
  return rows;
}

export async function setPartnerRequestStatus(
  id: number,
  status: PartnerRequestStatus,
  curatorNote?: string | null,
): Promise<PartnerRequest | null> {
  const { rows } = await query<PartnerRequest>(
    `UPDATE venue_partner_requests
        SET status = $2,
            curator_note = COALESCE($3, curator_note),
            updated_at = now()
      WHERE id = $1
      RETURNING ${PARTNER_COLUMNS}`,
    [id, status, curatorNote ?? null],
  );
  return rows[0] ?? null;
}

export async function countNewPartnerRequests(): Promise<number> {
  const { rows } = await query<{ n: string }>(
    "SELECT count(*)::text AS n FROM venue_partner_requests WHERE status = 'new'",
  );
  return Number(rows[0]?.n ?? 0);
}

// ------------------------------------------------------------------ earnings

/** SCENE's cut of a confirmed booking. Mirrors the 90% payout the host
 *  dashboard and partner page already state. */
export const SCENE_FEE_RATE = 0.1;

export interface VenueEarnings {
  /** Bookings that reached payment. */
  confirmedCount: number;
  completedCount: number;
  /** What organizers paid, in rupees. */
  grossValue: number;
  /** SCENE's share of that. */
  sceneFee: number;
  /** What venues keep. */
  venuePayout: number;
  /** Food and drink recorded against events, which is the venue's own revenue
   *  and deliberately not part of SCENE's fee. */
  orderRevenue: number;
}

/**
 * What we've earned, counted from bookings that actually reached payment.
 *
 * `requested` and `approved` bookings are excluded on purpose: nothing has been
 * paid until a booking is confirmed, so counting them would report revenue that
 * does not exist.
 */
export async function venueEarnings(venueSlug?: string): Promise<VenueEarnings> {
  const { rows } = await query<{
    confirmed: string;
    completed: string;
    gross: string;
  }>(
    `SELECT
       count(*) FILTER (WHERE status IN ('confirmed','checked_in','completed'))::text AS confirmed,
       count(*) FILTER (WHERE status = 'completed')::text AS completed,
       COALESCE(sum(total) FILTER (WHERE status IN ('confirmed','checked_in','completed')), 0)::text AS gross
     FROM venue_bookings
     WHERE ($1::text IS NULL OR venue_slug = $1)`,
    [venueSlug ?? null],
  );
  const { rows: orderRows } = await query<{ total: string }>(
    `SELECT COALESCE(sum(o.amount), 0)::text AS total
       FROM venue_booking_orders o
       JOIN venue_bookings b ON b.id = o.booking_id
      WHERE ($1::text IS NULL OR b.venue_slug = $1)`,
    [venueSlug ?? null],
  );

  const grossValue = Number(rows[0]?.gross ?? 0);
  const sceneFee = Math.round(grossValue * SCENE_FEE_RATE);
  return {
    confirmedCount: Number(rows[0]?.confirmed ?? 0),
    completedCount: Number(rows[0]?.completed ?? 0),
    grossValue,
    sceneFee,
    venuePayout: grossValue - sceneFee,
    orderRevenue: Number(orderRows[0]?.total ?? 0),
  };
}
