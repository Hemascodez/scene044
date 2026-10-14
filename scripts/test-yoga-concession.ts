import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { POST } from '../app/api/admin/venue-bookings/[id]/yoga-concession/route';
import { bookingChargePaise } from '../lib/venueOperations';
import { bookingFinancials } from '../lib/venuePricing';

const path = 'http://localhost:3000/api/admin/venue-bookings/42/yoga-concession';
const params = { params: Promise.resolve({ id: '42' }) };
const body = JSON.stringify({ bookingCode: 'SCN-ACD349' });
const request = (authorized: boolean, payload = body) => new Request(path, {
  method: 'POST', headers: {
    'Content-Type': 'application/json',
    ...(authorized ? { Authorization: `Basic ${btoa('curator:test-only-password')}` } : {}),
  }, body: payload,
});

async function main() {
  process.env.CURATOR_PASSWORD = 'test-only-password';
  assert.equal((await POST(request(false), params)).status, 401);
  assert.equal((await POST(request(true, '{}'), params)).status, 400);

  const statements: string[] = [];
  let eligible = true;
  globalThis.__pgPool = { connect: async () => ({
    query: async (sql: string) => {
      statements.push(sql);
      if (sql.includes('UPDATE venue_bookings')) return { rowCount: eligible ? 1 : 0 };
      return { rowCount: 0 };
    }, release: () => {},
  }) } as unknown as Pool;

  const success = await POST(request(true), params);
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { ok: true, total: 5000, hostAmount: 5000, sceneAmount: 0 });
  const update = statements.find(sql => sql.includes('UPDATE venue_bookings')) ?? '';
  for (const safety of [
    "venue_slug = 'chennai-yoga-studio'", 'duration_hours = 3', 'total = 6600',
    'b.paid_at IS NULL', 'b.trial_amount_paise IS NULL',
    'NOT EXISTS (SELECT 1 FROM venue_booking_payments',
    'host_amount = 5000', 'scene_amount = 0',
  ]) assert.ok(update.includes(safety), `Missing booking guard: ${safety}`);
  assert.deepEqual(statements.slice(0,2), ['BEGIN', 'SELECT id FROM venue_bookings WHERE id = $1 FOR UPDATE']);
  assert.equal(statements.at(-1), 'COMMIT');

  assert.equal(bookingChargePaise({ total: 5000, trialAmountPaise: null }), 500000);
  assert.deepEqual(bookingFinancials({ total: 5000, trialAmountPaise: null, hostAmount: 5000, sceneAmount: 0 }),
    { total: 5000, payout: 5000, sceneFee: 0 });

  eligible = false;
  assert.equal((await POST(request(true), params)).status, 409);
  console.log('Yoga Studio one-booking concession checks passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
