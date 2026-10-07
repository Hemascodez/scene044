import { readFileSync } from 'node:fs';
import { archiveBookingBatch } from '../lib/venueBookingArchive';
import { pool, query } from '../lib/db';

async function main() {
  const snapshot = JSON.parse(readFileSync(new URL('../db/prelaunch-booking-snapshot.json', import.meta.url), 'utf8')) as { capturedAt: string; venueSlug: string; reason: string; bookings: { id: number; code: string }[] };
  try {
    const rows = await query('SELECT id,code,status,paid_at IS NOT NULL AS paid FROM venue_bookings WHERE id = ANY($1::int[]) ORDER BY id', [snapshot.bookings.map(b => b.id)]);
    console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'dry-run', cutoff: snapshot.capturedAt, selected: rows.rows }, null, 2));
    if (!process.argv.includes('--apply')) { console.log('No changes made. Apply only after owner-reviewed local verification and rollout.'); return; }
    const count = await archiveBookingBatch(snapshot.venueSlug, snapshot.bookings, snapshot.reason, snapshot.capturedAt);
    console.log(`Archived ${count} records. Payment/order history retained; later bookings untouched. Restore through curator.`);
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Archive failed'); process.exitCode = 1; });
