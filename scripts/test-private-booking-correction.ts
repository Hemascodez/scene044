import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { POST } from '../app/api/admin/venue-bookings/[id]/private-correction/route';
import { bookingChargePaise } from '../lib/venueOperations';
import { bookingFinancials } from '../lib/venuePricing';

async function main() {
  process.env.CURATOR_PASSWORD = 'test-only-password';
  const params = { params: Promise.resolve({ id: '42' }) };
  const request = (body: unknown, authorized = true) => new Request('http://localhost/api/admin/venue-bookings/42/private-correction', {
    method: 'POST', body: JSON.stringify(body), headers: {
      'Content-Type': 'application/json',
      ...(authorized ? { Authorization: `Basic ${btoa('curator:test-only-password')}` } : {}),
    },
  });
  assert.equal((await POST(request({}, false), params)).status, 401);
  for (const body of [{}, { bookingCode: 'SCN-ACD349' }, { bookingCode: 'SCN-ACD349', hostAmount: 4950 },
    { bookingCode: 'wrong', hostAmount: 5500 }, { bookingCode: 'SCN-ACD349', hostAmount: '5500' }]) {
    assert.equal((await POST(request(body), params)).status, 400);
  }
  const statements: { sql: string; values?: unknown[] }[] = [];
  let eligible = true;
  let fails = false;
  globalThis.__pgPool = { connect: async () => ({
    query: async (sql: string, values?: unknown[]) => {
      statements.push({ sql, values });
      if (sql.includes('UPDATE venue_bookings')) {
        if (fails) throw { code: 'test-database-error' };
        return { rowCount: eligible ? 1 : 0 };
      }
      return { rowCount: 0 };
    }, release() {},
  }) } as unknown as Pool;
  for (const hostAmount of [5000, 5500]) {
    const response = await POST(request({ bookingCode: 'SCN-ACD349', hostAmount }), params);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, total: 5500, durationHours: 3.5, hostAmount, sceneAmount: 5500 - hostAmount });
    assert.deepEqual(bookingFinancials({ total: 5500, trialAmountPaise: null, hostAmount, sceneAmount: 5500 - hostAmount }),
      { total: 5500, payout: hostAmount, sceneFee: 5500 - hostAmount });
  }
  assert.equal(bookingChargePaise({ total: 5500, trialAmountPaise: null }), 550000);
  assert.equal(statements[0].sql, 'BEGIN');
  assert.equal(statements[1].sql, 'SELECT id FROM venue_bookings WHERE id = $1 FOR UPDATE');
  const update = statements.find(s => s.sql.includes('UPDATE venue_bookings'))!;
  assert.deepEqual(update.values, [42, 'SCN-ACD349', 5000]);
  for (const guard of [
    'duration_hours = 3.5', 'total = 5500', 'b.id = $1 AND b.code = $2', "b.venue_slug = 'chennai-yoga-studio'",
    "b.status = 'approved'", 'b.total = 6600', 'b.duration_hours IN (3, 4)',
    'b.archived_at IS NULL', 'b.paid_at IS NULL', 'b.checked_in_at IS NULL',
    'b.trial_amount_paise IS NULL', 'b.trial_duration_minutes IS NULL',
    'NOT EXISTS (SELECT 1 FROM venue_booking_payments',
  ]) assert.ok(update.sql.includes(guard), guard);
  assert.doesNotMatch(update.sql.split('WHERE')[0], /SET status|paid_at\s*=|trial_amount_paise\s*=|trial_duration_minutes\s*=/);
  eligible = false;
  assert.equal((await POST(request({ bookingCode: 'SCN-ACD349', hostAmount: 5500 }), params)).status, 409);
  fails = true;
  assert.equal((await POST(request({ bookingCode: 'SCN-ACD349', hostAmount: 5500 }), params)).status, 503);
  assert.equal(statements.at(-1)?.sql, 'ROLLBACK');
  console.log('PASS private booking correction: explicit payout, exact identity, locked approved/unpaid/no-order guard, ₹5,500 normal charge and rollback');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
