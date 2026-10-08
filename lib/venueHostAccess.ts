import { checkCuratorAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { getVenueUserFromRequest, normalizeIndianPhone } from '@/lib/venueUserAuth';

export const HOST_ACCESS_MESSAGE = 'Contact your Time Cafe admin to add your number to sign in.';
export const HOST_VENUE_SLUG = 'time-cafe';

export interface ApprovedHost {
  id: number;
  phone: string;
  label: string;
  approvedAt: string;
  revokedAt: string | null;
}

export function isSameOriginMutation(request: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  return site !== 'cross-site' && (!origin || origin === new URL(request.url).origin);
}

export async function isApprovedHostPhone(rawPhone: string): Promise<boolean> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) return false;
  const { rows } = await query(
    `SELECT id FROM venue_host_access WHERE venue_slug = $1 AND phone_e164 = $2 AND revoked_at IS NULL`,
    [HOST_VENUE_SLUG, phone],
  );
  return rows.length > 0;
}

/** Authority is a current database approval + a verified session, never a
 * client-selected role/venue. Read it again on every protected request. */
export async function checkHostAccess(request: Request, scopedBookingId?: number): Promise<boolean> {
  if (!isSameOriginMutation(request)) return false;
  if (await checkCuratorAccess(request)) return true;
  const user = await getVenueUserFromRequest(request);
  if (!user || user.role !== 'Host' || !await isApprovedHostPhone(user.phoneE164)) return false;
  const url = new URL(request.url);
  const venue = url.searchParams.get('venueSlug');
  if (venue && venue !== HOST_VENUE_SLUG) return false;
  // Every booking-id API is scoped here, including orders and completion.
  const id = scopedBookingId ?? url.pathname.match(/^\/api\/host\/bookings\/([^/]+)\//)?.[1];
  if (id !== undefined) {
    const bookingId = Number(id);
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) return false;
    const { rows } = await query(
      `SELECT id FROM venue_bookings WHERE id = $1 AND venue_slug = $2 AND archived_at IS NULL`,
      [bookingId, HOST_VENUE_SLUG],
    );
    return rows.length > 0;
  }
  return true;
}

export async function canAccessHostBooking(request: Request, venueSlug: string): Promise<boolean> {
  if (!await checkHostAccess(request)) return false;
  return await checkCuratorAccess(request) || venueSlug === HOST_VENUE_SLUG;
}

export async function listApprovedHosts(): Promise<ApprovedHost[]> {
  const { rows } = await query<ApprovedHost>(
    `SELECT id, phone_e164 AS phone, label, approved_at AS "approvedAt", revoked_at AS "revokedAt"
       FROM venue_host_access WHERE venue_slug = $1 ORDER BY (revoked_at IS NULL) DESC, approved_at DESC`,
    [HOST_VENUE_SLUG],
  );
  return rows;
}

export async function approveHost(rawPhone: string, label: string): Promise<void> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) throw new Error('Enter a valid 10-digit Indian mobile number.');
  await query(
    `INSERT INTO venue_host_access (venue_slug, phone_e164, label) VALUES ($1, $2, $3)
     ON CONFLICT (venue_slug, phone_e164) DO UPDATE SET
       label = EXCLUDED.label, approved_at = now(), revoked_at = NULL`,
    [HOST_VENUE_SLUG, phone, label.trim().slice(0, 120)],
  );
}

export async function revokeHost(id: number): Promise<boolean> {
  const result = await query(
    `UPDATE venue_host_access SET revoked_at = now() WHERE id = $1 AND venue_slug = $2 AND revoked_at IS NULL RETURNING id`,
    [id, HOST_VENUE_SLUG],
  );
  return result.rows.length > 0;
}
