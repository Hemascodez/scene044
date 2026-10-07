/** Real SQL checks inside an outer transaction; no fixture rows survive. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client, type Pool } from 'pg';
import { bookingChargePaise, validateMenuItems, prepareTrial, recordPaymentOrder, confirmCapturedPayment, addMenuOrder, saveMenuItems, listCuratorBookings } from '../lib/venueOperations';
import { checkInBooking, completeBooking, listBookingOrders } from '../lib/venueBookings';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect(); await client.query('BEGIN');
  // Library transactions become savepoints so the outer test can roll back all writes.
  const testQuery = async (sql: string, params?: unknown[]) => {
    if (sql === 'BEGIN') return client.query('SAVEPOINT operation');
    if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT operation');
    if (sql === 'ROLLBACK') { await client.query('ROLLBACK TO SAVEPOINT operation'); return client.query('RELEASE SAVEPOINT operation'); }
    return client.query(sql, params);
  };
  globalThis.__pgPool = { query: testQuery, connect: async () => ({ query: testQuery, release() {} }) } as unknown as Pool;
  try {
    assert.equal(bookingChargePaise({ trialAmountPaise: 1000, total: 2000 }), 1000);
    assert.equal(bookingChargePaise({ trialAmountPaise: null, total: 2000 }), 200000);
    assert.equal(validateMenuItems([{ id: randomUUID(), name: 'Coffee', category: 'Drinks', pricePaise: -1, available: true }]), null);
    const marker = randomUUID();
    const fixture = await client.query<{ id: number }>(`INSERT INTO venue_bookings(code,checkin_token,venue_slug,venue_name,space_id,space_name,event_date,start_time,duration_hours,people,event_type,description,organizer_name,organizer_email,organizer_phone,hourly_rate,total)
      VALUES ($1,$2,'time-cafe','Time Cafe','first-floor','First floor',CURRENT_DATE,'18:00',2,1,'Internal verification','ROLLBACK-only SQL fixture','Verification','verification@example.invalid','',1000,2000) RETURNING id`, [`TEST-${marker}`, marker]);
    const id = fixture.rows[0].id;
    assert.equal(await checkInBooking(id), null, 'unpaid booking cannot start');
    assert.equal(await prepareTrial(id), true);
    await client.query("UPDATE venue_bookings SET status = 'approved' WHERE id = $1", [id]);
    assert.equal(await recordPaymentOrder(id, `order_${marker}`, 200000), false, 'price tampering rejected');
    assert.equal(await recordPaymentOrder(id, `order_${marker}`, 1000), true);
    assert.equal(await prepareTrial(id), false, 'cannot change a payment order');
    assert.equal(await recordPaymentOrder(id, `order_second${marker}`, 1000), false, 'one payable order per booking');
    assert.equal(await confirmCapturedPayment(id, `order_${marker}`, `pay_${marker}`), true);
    assert.equal(await confirmCapturedPayment(id, `order_${marker}`, `pay_${marker}`), true, 'confirmation idempotent');
    const checked = await checkInBooking(id); assert.ok(checked?.endsAt && checked.checkedInAt);
    assert.equal(new Date(checked.endsAt).getTime() - new Date(checked.checkedInAt).getTime(), 300000);
    assert.equal(await checkInBooking(id), null, 'second scan cannot reset timer');
    const itemId = randomUUID();
    await saveMenuItems([{ id: itemId, name: 'Verification coffee', category: 'Drinks', pricePaise: 12345, available: true }]);
    const requestKey = randomUUID();
    const order = await addMenuOrder(id, itemId, 2, requestKey); assert.equal(order?.unitPricePaise, 12345);
    assert.equal((await addMenuOrder(id, itemId, 2, requestKey))?.id, order?.id, 'order retry deduplicated');
    assert.equal((await listBookingOrders(id)).length, 1);
    await saveMenuItems([]); assert.equal((await listBookingOrders(id))[0].description, 'Verification coffee', 'menu edit preserves historic tab');
    assert.ok((await listCuratorBookings(1)).bookings.find(b => b.id === id));
    assert.ok(await completeBooking(id));
    console.log('PASS: server pricing, trial guard, captured-payment binding/idempotence, unpaid/double QR guard, five-minute timer, menu snapshots, order retry, curator visibility, completion.');
  } finally { await client.query('ROLLBACK'); await client.end(); globalThis.__pgPool = undefined; }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Verification failed'); process.exitCode = 1; });
