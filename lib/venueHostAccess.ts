import { checkCuratorAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { getVenueUserFromRequest, normalizeIndianPhone } from '@/lib/venueUserAuth';

export const HOST_ACCESS_MESSAGE = 'Contact your venue admin to add your number to sign in.';
export const HOST_VENUE_SLUG = 'time-cafe';

export interface ApprovedHost {
  id: number;
  phone: string;
  label: string;
  approvedAt: string;
  revokedAt: string | null;
  venueSlug: string;
  venueName: string;
}

export interface HostVenueOption { slug: string; name: string; }

export function isSameOriginMutation(request: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  // Railway terminates TLS and Next may see an internal HTTP URL. Trust our
  // canonical public origins, never a client-supplied forwarding/Host header.
  return site !== 'cross-site' && (!origin || origin === new URL(request.url).origin ||
    origin === 'https://scene044.in' || origin === 'https://www.scene044.in');
}

export async function isApprovedHostPhone(rawPhone: string, venue = 'Time Cafe'): Promise<boolean> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) return false;
  const { rows } = await query(
    `SELECT h.id FROM venue_host_access h JOIN venues v ON v.slug = h.venue_slug
       WHERE (v.slug = $1 OR v.name = $1) AND h.phone_e164 = $2 AND h.revoked_at IS NULL`,
    [venue, phone],
  );
  return rows.length > 0;
}

/** Authority is a current database approval + a verified session, never a
 * client-selected role/venue. Read it again on every protected request. */
export async function checkHostAccess(request: Request, scopedBookingId?: number): Promise<boolean> {
  if (!isSameOriginMutation(request)) return false;
  if (await checkCuratorAccess(request)) return true;
  const user = await getVenueUserFromRequest(request);
  if (!user || user.role !== 'Host' || !user.hostVenueSlug) return false;
  const url = new URL(request.url);
  const venue = url.searchParams.get('venueSlug');
  if (venue && venue !== user.hostVenueSlug) return false;
  // Every booking-id API is scoped here, including orders and completion.
  const id = scopedBookingId ?? url.pathname.match(/^\/api\/host\/bookings\/([^/]+)\//)?.[1];
  if (id !== undefined) {
    const bookingId = Number(id);
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) return false;
    const { rows } = await query(
      `SELECT id FROM venue_bookings WHERE id = $1 AND venue_slug = $2 AND archived_at IS NULL`,
      [bookingId, user.hostVenueSlug],
    );
    return rows.length > 0;
  }
  return true;
}

export async function canAccessHostBooking(request: Request, venueSlug: string): Promise<boolean> {
  if (!await checkHostAccess(request)) return false;
  return await checkCuratorAccess(request) || venueSlug === (await getVenueUserFromRequest(request))?.hostVenueSlug;
}

/** The owning venue comes from the server's approved host scope, never a
 * slug supplied by the browser. Curators preview the same Time Cafe workspace. */
export async function getHostVenueSlug(request: Request): Promise<string | null> {
  if (!await checkHostAccess(request)) return null;
  if (await checkCuratorAccess(request)) return HOST_VENUE_SLUG;
  return (await getVenueUserFromRequest(request))?.hostVenueSlug ?? null;
}

export async function listHostVenues(): Promise<HostVenueOption[]> {
  return (await query<HostVenueOption>('SELECT slug, name FROM venues ORDER BY name, slug')).rows;
}

export async function listApprovedHosts(): Promise<ApprovedHost[]> {
  const { rows } = await query<ApprovedHost>(
    `SELECT h.id, h.phone_e164 AS phone, h.label, h.approved_at AS "approvedAt", h.revoked_at AS "revokedAt",
        h.venue_slug AS "venueSlug", COALESCE(v.name, h.venue_slug) AS "venueName"
       FROM venue_host_access h LEFT JOIN venues v ON v.slug = h.venue_slug
       ORDER BY (h.revoked_at IS NULL) DESC, h.approved_at DESC, h.id DESC`,
  );
  return rows;
}

export async function approveHost(rawPhone: string, label: string, venueSlug = HOST_VENUE_SLUG): Promise<boolean> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) throw new Error('Enter a valid 10-digit Indian mobile number.');
  const { rows } = await query(
    `INSERT INTO venue_host_access (venue_slug, phone_e164, label)
     SELECT slug, $2, $3 FROM venues WHERE slug = $1
     ON CONFLICT (venue_slug, phone_e164) DO UPDATE SET
       label = EXCLUDED.label, approved_at = now(), revoked_at = NULL RETURNING id`,
    [venueSlug, phone, label.trim().slice(0, 120)],
  );
  return rows.length > 0;
}

export async function revokeHost(id: number): Promise<boolean> {
  const result = await query(
    `UPDATE venue_host_access SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING id`,
    [id],
  );
  return result.rows.length > 0;
}
