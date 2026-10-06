import { pool, query } from '@/lib/db';
import { amountDue } from '@/lib/venues';
import { BOOKING_COLUMNS, type VenueBooking, type VenueBookingOrder } from '@/lib/venueBookings';

export async function listCuratorBookings(page: number) {
  const { rows } = await query<VenueBooking & { foodTotalPaise: number; paymentId: string | null }>(`SELECT ${BOOKING_COLUMNS},
    COALESCE((SELECT SUM(COALESCE(unit_price_paise * quantity, amount * 100)) FROM venue_booking_orders o WHERE o.booking_id = b.id), 0)::int AS "foodTotalPaise",
    (SELECT payment_id FROM venue_booking_payments p WHERE p.booking_id = b.id AND p.paid_at IS NOT NULL LIMIT 1) AS "paymentId"
    FROM venue_bookings b ORDER BY created_at DESC, id DESC LIMIT 50 OFFSET $1`, [(page - 1) * 50]);
  const count = await query<{ count: number }>('SELECT COUNT(*)::int AS count FROM venue_bookings');
  return { bookings: rows, count: count.rows[0].count, page };
}

/** Explicit curator opt-in only; never changes a booking with a payment order. */
export async function prepareTrial(bookingId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM venue_bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    const updated = await client.query(`UPDATE venue_bookings b SET trial_duration_minutes = 5, trial_amount_paise = 1000, updated_at = now()
      WHERE id = $1 AND venue_slug = 'time-cafe' AND status IN ('requested','approved')
      AND NOT EXISTS (SELECT 1 FROM venue_booking_payments p WHERE p.booking_id = b.id)`, [bookingId]);
    await client.query('COMMIT'); return updated.rowCount === 1;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export interface MenuItem {
  id: string; name: string; category: string; pricePaise: number; available: boolean;
}
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MENU_COLUMNS = 'id, name, category, price_paise AS "pricePaise", available';

export function bookingChargePaise(booking: Pick<VenueBooking, 'trialAmountPaise' | 'total'>): number | null {
  return booking.trialAmountPaise ?? (booking.total === null ? null : Math.round(amountDue(booking.total) * 100));
}

export async function listMenuItems(venueSlug = 'time-cafe'): Promise<MenuItem[]> {
  return (await query<MenuItem>(`SELECT ${MENU_COLUMNS} FROM venue_menu_items WHERE venue_slug = $1 ORDER BY sort_order, id`, [venueSlug])).rows;
}

export function validateMenuItems(value: unknown): MenuItem[] | null {
  if (!Array.isArray(value) || value.length > 200) return null;
  const items: MenuItem[] = [];
  const ids = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const { id, name, category, pricePaise, available } = raw;
    if (typeof id !== 'string' || !UUID_PATTERN.test(id) || ids.has(id) ||
        typeof name !== 'string' || !name.trim() || name.length > 150 ||
        typeof category !== 'string' || category.length > 80 ||
        !Number.isSafeInteger(pricePaise) || pricePaise < 0 || pricePaise > 10000000 || typeof available !== 'boolean') return null;
    ids.add(id);
    items.push({ id, name: name.trim(), category: category.trim() || 'Menu', pricePaise, available });
  }
  return items;
}

export async function saveMenuItems(items: MenuItem[], venueSlug = 'time-cafe'): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`menu:${venueSlug}`]);
    await client.query('DELETE FROM venue_menu_items WHERE venue_slug = $1', [venueSlug]);
    for (const [index, item] of items.entries()) {
      await client.query(`INSERT INTO venue_menu_items(id, venue_slug, name, category, price_paise, available, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [item.id, venueSlug, item.name, item.category, item.pricePaise, item.available, index]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function addMenuOrder(bookingId: number, menuItemId: string, quantity: number, requestKey: string): Promise<VenueBookingOrder | null> {
  const { rows } = await query<VenueBookingOrder>(`
    INSERT INTO venue_booking_orders(booking_id, description, amount, menu_item_id, quantity, unit_price_paise, request_key)
    SELECT b.id, m.name, CEIL(m.price_paise * $3::numeric / 100)::int, m.id, $3, m.price_paise, $4
      FROM venue_bookings b JOIN venue_menu_items m ON m.venue_slug = b.venue_slug
      WHERE b.id = $1 AND m.id = $2 AND m.available AND b.status = 'checked_in'
    ON CONFLICT (booking_id, request_key) WHERE request_key IS NOT NULL
    DO UPDATE SET request_key = EXCLUDED.request_key
    RETURNING id, description, amount, quantity, unit_price_paise AS "unitPricePaise", created_at AS "createdAt"`,
    [bookingId, menuItemId, quantity, requestKey]);
  return rows[0] ?? null;
}

export async function recordPaymentOrder(bookingId: number, orderId: string, amountPaise: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<Pick<VenueBooking, 'total' | 'trialAmountPaise' | 'status'>>(`SELECT total, trial_amount_paise AS "trialAmountPaise", status FROM venue_bookings WHERE id = $1 FOR UPDATE`, [bookingId]);
    if (!rows[0] || rows[0].status !== 'approved' || bookingChargePaise(rows[0]) !== amountPaise) { await client.query('ROLLBACK'); return false; }
    const result = await client.query(`INSERT INTO venue_booking_payments(order_id, booking_id, amount_paise) VALUES ($2,$1,$3) ON CONFLICT DO NOTHING`, [bookingId, orderId, amountPaise]);
    await client.query('COMMIT'); return result.rowCount === 1;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function latestPaymentOrder(bookingId: number) {
  return (await query<{ orderId: string; amountPaise: number; currency: string }>(`SELECT order_id AS "orderId", amount_paise AS "amountPaise", currency FROM venue_booking_payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1`, [bookingId])).rows[0] ?? null;
}

export async function getPaymentOrder(orderId: string) {
  return (await query<{ bookingId: number; amountPaise: number; currency: string; paymentId: string | null }>(
    `SELECT booking_id AS "bookingId", amount_paise AS "amountPaise", currency, payment_id AS "paymentId"
       FROM venue_booking_payments WHERE order_id = $1`, [orderId])).rows[0] ?? null;
}

export async function confirmCapturedPayment(bookingId: number, orderId: string, paymentId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ status: string }>('SELECT status FROM venue_bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    if (!rows[0] || !['approved', 'confirmed', 'checked_in', 'completed'].includes(rows[0].status)) {
      await client.query('ROLLBACK'); return false;
    }
    const other = await client.query('SELECT 1 FROM venue_booking_payments WHERE booking_id = $1 AND paid_at IS NOT NULL AND order_id <> $2', [bookingId, orderId]);
    if (other.rowCount) { await client.query('ROLLBACK'); return false; }
    const saved = await client.query(`UPDATE venue_booking_payments SET payment_id = $3, paid_at = COALESCE(paid_at, now())
      WHERE order_id = $1 AND booking_id = $2 AND (payment_id IS NULL OR payment_id = $3)`, [orderId, bookingId, paymentId]);
    if (!saved.rowCount) { await client.query('ROLLBACK'); return false; }
    await client.query(`UPDATE venue_bookings SET status = CASE WHEN status = 'approved' THEN 'confirmed' ELSE status END,
      paid_at = COALESCE(paid_at, now()), updated_at = now() WHERE id = $1`, [bookingId]);
    await client.query('COMMIT'); return true;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
