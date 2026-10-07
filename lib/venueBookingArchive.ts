import { pool, query } from '@/lib/db';

/** Exact IDs plus codes bind the approved cleanup to the intended records.
 * Never broad-delete a venue or mutate payment, order, review or status history. */
export async function archiveBookingBatch(venueSlug: string, entries: { id: number; code: string }[], reason: string, cutoff: string): Promise<number> {
  if (venueSlug !== 'time-cafe' || !entries.length || !reason.trim() || entries.some(b => !Number.isSafeInteger(b.id) || b.id < 1 || !/^SCN-[A-Z0-9]{6}$/.test(b.code)) || new Set(entries.map(b => b.id)).size !== entries.length || !Number.isFinite(Date.parse(cutoff))) throw new Error('Invalid archive selection');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: number; code: string; venue_slug: string; before_cutoff: boolean }>(`SELECT id,code,venue_slug,created_at <= $2::timestamptz AS before_cutoff FROM venue_bookings WHERE id = ANY($1::int[]) FOR UPDATE`, [entries.map(b => b.id), cutoff]);
    if (rows.length !== entries.length || rows.some(b => b.venue_slug !== venueSlug || !b.before_cutoff || !entries.some(e => e.id === b.id && e.code === b.code))) throw new Error('Archive snapshot does not match this database');
    const pending = await client.query(`SELECT 1 FROM venue_booking_payments WHERE booking_id = ANY($1::int[]) AND paid_at IS NULL LIMIT 1`, [entries.map(b => b.id)]);
    if (pending.rowCount) throw new Error('A selected booking has an unresolved payment order. Reconcile it before archiving.');
    const updated = await client.query(`UPDATE venue_bookings SET archived_at = now(), archive_reason = $2, updated_at = now() WHERE id = ANY($1::int[]) AND archived_at IS NULL`, [entries.map(b => b.id), reason]);
    await client.query('COMMIT');
    return updated.rowCount ?? 0;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function restoreArchivedBooking(id: number): Promise<boolean> {
  const result = await query('UPDATE venue_bookings SET archived_at = NULL, archive_reason = NULL, updated_at = now() WHERE id = $1 AND archived_at IS NOT NULL', [id]);
  return result.rowCount === 1;
}
