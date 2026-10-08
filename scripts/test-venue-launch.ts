/** Real PostgreSQL SQL in an ephemeral PGlite instance. Never reads DATABASE_URL.
 * Install @electric-sql/pglite outside the repo, then pass --pglite=/absolute/package/path.
 * All gateway traffic is stubbed; no messages, charges, or cloud writes. */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Pool } from 'pg';
import { amountDue } from '../lib/venues';
import { archiveBookingBatch } from '../lib/venueBookingArchive';
import { bookingChargePaise, confirmCapturedPayment, recordPaymentOrder, prepareTrial, listCuratorBookings, addMenuOrder } from '../lib/venueOperations';
import { checkInBooking, completeBooking, listBookingsForOrganizer, listVenueBookings, getBookingByCheckinToken, setBookingStatus, findOverrunBookings, claimOverrunNotification, createVenueReview, listVenueReviews } from '../lib/venueBookings';
import { listPublicVenues, venueEarnings } from '../lib/venueCatalog';
import { hashVenueSession, VENUE_SESSION_COOKIE } from '../lib/venueUserAuth';
import { POST as createOrder } from '../app/api/razorpay/create-order/route';
import { POST as verifyPayment } from '../app/api/razorpay/verify-payment/route';
import { POST as trialRoute } from '../app/api/admin/venue-bookings/[id]/trial/route';
import { POST as restoreRoute } from '../app/api/admin/venue-bookings/[id]/restore/route';
import { POST as submitBooking, GET as myBookings } from '../app/api/venue-bookings/route';
import { GET as hostReviews } from '../app/api/host/reviews/route';
import { validateVenueBookingWindow } from '../lib/venueBookingValidation';
import { POST as hostStatus } from '../app/api/host/bookings/[id]/status/route';
import { POST as scanQr } from '../app/api/host/checkin/route';
import { POST as finishBooking } from '../app/api/host/bookings/[id]/complete/route';
import { PUT as saveDraft, GET as readDraft } from '../app/api/venue-booking-drafts/route';

interface LocalPg {
  exec(sql: string): Promise<unknown>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; affectedRows: number }>;
  close(): Promise<void>;
}

async function main() {
  const modulePath = process.argv.find(arg => arg.startsWith('--pglite='))?.slice('--pglite='.length);
  if (!modulePath?.startsWith('/')) throw new Error('Provide --pglite=/absolute/path/to/@electric-sql/pglite (temporary test dependency).');
  const { PGlite } = createRequire(import.meta.url)(modulePath) as { PGlite: { create(): Promise<LocalPg> } };
  const db = await PGlite.create();
  const previousPool = globalThis.__pgPool;
  const previousFetch = globalThis.fetch;
  const envNames = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'CURATOR_PASSWORD'] as const;
  const previousEnv = envNames.map(key => process.env[key]);
  process.env.RAZORPAY_KEY_ID = 'rzp_test_fixture';
  process.env.RAZORPAY_KEY_SECRET = 'fixture-not-a-real-secret';
  process.env.CURATOR_PASSWORD = 'fixture-curator-only';
  const sql = async (text: string, params?: unknown[]) => {
    const result = await db.query(text, params);
    return { ...result, rowCount: /^\s*SELECT\b/i.test(text) ? result.rows.length : result.affectedRows };
  };
  globalThis.__pgPool = { query: sql, connect: async () => ({ query: sql, release() {} }) } as unknown as Pool;
  const token = 'a'.repeat(64);
  const request = (path: string, body: Record<string, unknown> = {}, curator = false) => new Request(`http://localhost:3000${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie: `${VENUE_SESSION_COOKIE}=${token}`,
      ...(curator ? { authorization: `Basic ${Buffer.from(`curator:${process.env.CURATOR_PASSWORD}`).toString('base64')}` } : {}) },
    body: JSON.stringify(body),
  });
  let gatewayCalls = 0;
  let orderAmount = 0;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'https://api.razorpay.com/v1/orders', 'unexpected external request is blocked');
    gatewayCalls++;
    const body = JSON.parse(String(init?.body));
    orderAmount = body.amount;
    return Response.json({ id: gatewayCalls === 1 ? 'order_fixture' : `order_fixture${gatewayCalls}`, amount: body.amount, currency: 'INR', receipt: body.receipt, status: 'created' });
  };
  try {
    const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
    const start = schema.indexOf('CREATE TABLE IF NOT EXISTS venue_users');
    const end = schema.indexOf('ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS archived_at');
    assert.ok(start > 0 && end > start);
    await db.exec(schema.slice(start, end));
    for (let repeat = 0; repeat < 2; repeat++) {
      for (const migration of ['2026-10-07-venue-booking-archive.sql', '2026-10-07-venue-profile-photos.sql', '2026-10-08-venue-host-access.sql', '2026-10-08-venue-notifications.sql']) {
        await db.exec(readFileSync(new URL(`../db/migrations/${migration}`, import.meta.url), 'utf8'));
      }
    }
    await sql("INSERT INTO venue_users(id,phone_e164,name) VALUES(1,'919876543210','Fixture organiser')");
    await sql("INSERT INTO venue_user_sessions(user_id,token_hash,expires_at) VALUES(1,$1,now()+interval '1 day')", [hashVenueSession(token)]);
    await sql("INSERT INTO venues(id,slug,name,area,status) VALUES(1,'time-cafe','Time Cafe','Nungambakkam','live'),(2,'other-fixture','Other fixture','Test','live')");
    await sql("INSERT INTO venue_spaces(venue_id,space_key,name,max_guests,community_rate,production_rate) VALUES(1,'first-floor','First floor',30,2000,2000)");
    assert.deepEqual((await listPublicVenues()).map(v => v.slug), ['time-cafe']);
    // Synthetic selection, not the private production-booking snapshot.
    const manifest = {
      capturedAt: '2026-10-07T06:46:00Z', venueSlug: 'time-cafe', reason: 'Local regression fixture',
      bookings: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, code: `SCN-FX${String(i + 1).padStart(4, '0')}` })),
    };
    const addBooking = async (id: number, code: string, createdAt: string, venue = 'time-cafe') => sql(`INSERT INTO venue_bookings
      (id,code,checkin_token,venue_slug,venue_name,space_id,space_name,event_date,start_time,duration_hours,people,event_type,description,organizer_name,organizer_email,organizer_phone,organizer_user_id,hourly_rate,total,created_at)
      VALUES($1,$2,$3,$4,'Time Cafe','first-floor','First floor','2026-10-24','18:00',3,10,'Tech meetup','Local SQL fixture','Fixture organiser','fixture@example.invalid','919876543210',1,2000,6000,$5)`,
      [id, code, `token-${id}`, venue, createdAt]);
    for (const b of manifest.bookings) await addBooking(b.id, b.code, '2026-10-06T00:00:00Z');
    await addBooking(11, 'SCN-NEW123', '2026-10-07T07:00:00Z');
    await addBooking(12, 'SCN-OLD123', '2026-10-06T00:00:00Z');
    await addBooking(13, 'SCN-OTHER1', '2026-10-06T00:00:00Z', 'other-fixture');
    await sql("UPDATE venue_bookings SET status='approved' WHERE id IN(1,7)");
    assert.equal(amountDue(6000), 6000);
    assert.equal(bookingChargePaise({ total: 6000, trialAmountPaise: null }), 600000);
    const checkout = await createOrder(request('/api/razorpay/create-order', { token: 'token-1', amount: 1 }));
    assert.equal(checkout.status, 200);
    assert.equal((await checkout.json()).amount, 600000);
    assert.equal(orderAmount, 600000, 'server charges listed venue total, ignoring client price');
    assert.equal(await confirmCapturedPayment(1, 'order_fixture', 'pay_fixture'), true);
    const earnings = await venueEarnings('time-cafe');
    assert.equal(earnings.grossValue, 6000);
    assert.equal(earnings.sceneFee, 600);
    assert.equal(earnings.venuePayout, 5400);
    assert.equal((await trialRoute(request('/api/admin/venue-bookings/9/trial'), { params: Promise.resolve({ id: '9' }) })).status, 401);
    assert.equal((await trialRoute(request('/api/admin/venue-bookings/9/trial', {}, true), { params: Promise.resolve({ id: '9' }) })).status, 200);
    assert.equal(await prepareTrial(1), false, 'cannot convert a paid booking into a trial');
    await sql("UPDATE venue_bookings SET status='approved' WHERE id=9");
    assert.equal(await recordPaymentOrder(9, 'order_trial', 600000), false);
    assert.equal(await recordPaymentOrder(9, 'order_trial', 1000), true);
    assert.equal(await confirmCapturedPayment(9, 'order_trial', 'pay_trial'), true);
    const started = await checkInBooking(9);
    assert.ok(started);
    assert.equal(new Date(started.endsAt!).getTime() - new Date(started.checkedInAt!).getTime(), 300000);
    assert.equal(await checkInBooking(9), null, 'repeat QR scan cannot reset timer');
    assert.ok(await completeBooking(9));
    await sql("UPDATE venue_bookings SET status='checked_in',ends_at=now()-interval '1 minute' WHERE id=2");
    assert.ok((await findOverrunBookings()).some(b => b.id === 2));
    await sql("INSERT INTO venue_booking_orders(booking_id,description,amount) VALUES(9,'Fixture coffee',100)");
    await sql("INSERT INTO venue_reviews(booking_id,venue_slug,rating) VALUES(9,'time-cafe',5)");
    const paymentsBefore = JSON.stringify((await sql('SELECT * FROM venue_booking_payments ORDER BY order_id')).rows);
    const ordersBefore = JSON.stringify((await sql('SELECT * FROM venue_booking_orders ORDER BY id')).rows);
    const reviewsBefore = JSON.stringify((await sql('SELECT * FROM venue_reviews ORDER BY id')).rows);
    await assert.rejects(archiveBookingBatch('time-cafe', [{ id: 1, code: 'SCN-WRONG1' }], manifest.reason, manifest.capturedAt));
    await assert.rejects(archiveBookingBatch('time-cafe', [{ id: 13, code: 'SCN-OTHER1' }], manifest.reason, manifest.capturedAt));
    await assert.rejects(archiveBookingBatch('time-cafe', [{ id: 11, code: 'SCN-NEW123' }], manifest.reason, manifest.capturedAt));
    // An earlier +10% order is blocked before any gateway request/capture.
    await sql("INSERT INTO venue_booking_payments(order_id,booking_id,amount_paise) VALUES('order_oldfee',7,660000)");
    const callsBefore = gatewayCalls;
    assert.equal((await createOrder(request('/api/razorpay/create-order', { token: 'token-7' }))).status, 409);
    const signature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!).update('order_oldfee|pay_oldfee').digest('hex');
    assert.equal((await verifyPayment(request('/api/razorpay/verify-payment', { token: 'token-7', razorpay_order_id: 'order_oldfee', razorpay_payment_id: 'pay_oldfee', razorpay_signature: signature }))).status, 409);
    assert.equal(gatewayCalls, callsBefore, 'old extra-fee order must not be captured');
    await assert.rejects(archiveBookingBatch(manifest.venueSlug, manifest.bookings, manifest.reason, manifest.capturedAt), /unresolved payment/);
    assert.equal((await sql('SELECT count(*)::int AS n FROM venue_bookings WHERE archived_at IS NOT NULL')).rows[0].n, 0, 'blocked archive rolls back the whole batch');
    await sql("DELETE FROM venue_booking_payments WHERE order_id='order_oldfee'"); // Disposable fixture only.
    assert.equal(await archiveBookingBatch(manifest.venueSlug, manifest.bookings, manifest.reason, manifest.capturedAt), 9);
    assert.equal(await archiveBookingBatch(manifest.venueSlug, manifest.bookings, manifest.reason, manifest.capturedAt), 0, 'rerunning is idempotent');
    assert.deepEqual((await listVenueBookings('time-cafe')).map(b => b.id).sort((a,b) => a-b), [11,12]);
    assert.equal((await listBookingsForOrganizer(1)).length, 3);
    assert.equal((await listCuratorBookings(1, true)).count, 9);
    assert.equal((await listVenueReviews('time-cafe')).length, 0, 'archived/trial reviews are retained, not public testimonials');
    assert.equal((await venueEarnings('time-cafe')).grossValue, 0);
    assert.equal(await getBookingByCheckinToken('token-1'), null);
    assert.equal(await setBookingStatus(7, 'confirmed'), null);
    assert.equal(await checkInBooking(1), null);
    assert.equal(await completeBooking(2), null);
    assert.equal(await claimOverrunNotification(2), false);
    assert.equal((await findOverrunBookings()).length, 0);
    assert.equal(await prepareTrial(7), false);
    assert.equal(await recordPaymentOrder(7, 'order_archived', 600000), false);
    assert.equal(await confirmCapturedPayment(1, 'order_fixture', 'pay_fixture'), false);
    assert.equal(await addMenuOrder(2, '00000000-0000-4000-8000-000000000001', 1, '00000000-0000-4000-8000-000000000002'), null);
    assert.equal(await createVenueReview({ bookingId: 10, venueSlug: 'time-cafe', rating: 5, tags: [], comment: null, photoIds: [], photoConsent: false }), null);
    assert.equal((await createOrder(request('/api/razorpay/create-order', { token: 'token-1' }))).status, 404);
    assert.equal(JSON.stringify((await sql('SELECT * FROM venue_booking_payments ORDER BY order_id')).rows), paymentsBefore);
    assert.equal(JSON.stringify((await sql('SELECT * FROM venue_booking_orders ORDER BY id')).rows), ordersBefore);
    assert.equal(JSON.stringify((await sql('SELECT * FROM venue_reviews ORDER BY id')).rows), reviewsBefore);
    const ctx = { params: Promise.resolve({ id: '1' }) };
    assert.equal((await restoreRoute(request('/api/admin/venue-bookings/1/restore'), ctx)).status, 401);
    assert.equal((await restoreRoute(request('/api/admin/venue-bookings/1/restore', {}, true), ctx)).status, 200);
    assert.equal((await getBookingByCheckinToken('token-1'))?.status, 'confirmed');
    assert.equal((await venueEarnings('time-cafe')).venuePayout, 5400);
    // Real request endpoint, real DB persistence, authenticated identity and
    // host feed; all fixtures live only in this disposable local instance.
    await sql("UPDATE venue_users SET email='fixture@example.invalid' WHERE id=1");
    await sql("SELECT setval(pg_get_serial_sequence('venue_bookings','id'),100)");
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10);
    const body = { venueSlug: 'time-cafe', spaceId: 'first-floor', eventType: 'Tech meetup', date: futureDate, time: '11:00', duration: 3,
      people: 10, description: 'Local isolated booking flow check', name: 'Tampered name', phone: '999', total: 1, hourlyRate: 1 };
    assert.equal((await submitBooking(new Request('http://localhost:3000/api/venue-bookings', { method: 'POST', body: JSON.stringify(body) }))).status,401);
    for (const invalid of [{ date: '2026-02-30' }, { date: '2020-01-01' }, { time: '25:00' }, { time: '22:00' },
      { duration: 2 }, { duration: 3.5 }, { people: 1.5 }, { people: 31 }, { venueSlug: 'other-fixture' }, { spaceId: 'missing' }]) {
      assert.equal((await submitBooking(request('/api/venue-bookings', { ...body, ...invalid }))).status,400,JSON.stringify(invalid));
    }
    assert.equal(validateVenueBookingWindow('2026-10-08','08:00',3,new Date('2026-10-08T03:00:00Z'))?.field,'date', 'IST start already passed');
    assert.equal(validateVenueBookingWindow('2026-10-08','09:00',3,new Date('2026-10-08T03:00:00Z')),null);
    // Change the curator rate: the API must use the current DB rate, not a
    // prototype constant or any submitted customer price.
    await sql('UPDATE venue_spaces SET community_rate=1200 WHERE venue_id=1');
    const draftPayload = { venueSlug:'time-cafe',spaceId:'first-floor',formData:{kind:'figma',eventType:'Tech meetup',date:futureDate,start:'11:00',hours:3,guests:'10',message:'Local draft progress'},editedAtMs:Date.now() };
    const draftResponse = await saveDraft(new Request(request('/api/venue-booking-drafts',draftPayload),{method:'PUT'}));
    assert.equal(draftResponse.status,200,'catalog space IDs persist account drafts');
    const draftRequest = new Request('http://localhost:3000/api/venue-booking-drafts?venueSlug=time-cafe',{headers:{cookie:`${VENUE_SESSION_COOKIE}=${token}`}});
    assert.equal((await (await readDraft(draftRequest)).json()).draft.spaceId,'first-floor');
    const submitted = await submitBooking(request('/api/venue-bookings', body));
    assert.equal(submitted.status,200);
    const result = await submitted.json();
    assert.equal(result.total,3600);
    assert.equal(result.status,'requested');
    assert.equal((await (await readDraft(draftRequest)).json()).draft,null,'submitted drafts cannot reappear on another device');
    const persisted = await getBookingByCheckinToken(result.token);
    assert.equal(persisted?.organizerName,'Fixture organiser');
    assert.equal(persisted?.organizerUserId,1);
    assert.ok((await listVenueBookings('time-cafe')).some(b => b.id === result.id));
    const accountBookings = await myBookings(new Request('http://localhost:3000/api/venue-bookings', { headers: { cookie: `${VENUE_SESSION_COOKIE}=${token}` } }));
    assert.ok((await accountBookings.json()).entries.some((e: { booking: { id: number } }) => e.booking.id === result.id));
    const bookingContext = { params: Promise.resolve({ id: String(result.id) }) };
    assert.equal((await createOrder(request('/api/razorpay/create-order', { token: result.token }))).status,409,'no payment before approval');
    assert.equal((await hostStatus(request('/api/host/bookings/status', { status: 'approved' }),bookingContext)).status,401);
    assert.equal((await hostStatus(request('/api/host/bookings/status', { status: 'approved' },true),bookingContext)).status,200);
    const orderResponse = await createOrder(request('/api/razorpay/create-order', { token: result.token }));
    assert.equal(orderResponse.status,200);
    const newOrder = await orderResponse.json();
    assert.equal(newOrder.amount,360000);
    const orderStub = globalThis.fetch;
    globalThis.fetch = async input => {
      assert.equal(String(input),'https://api.razorpay.com/v1/payments/pay_bookingFixture');
      return Response.json({ id:'pay_bookingFixture',order_id:newOrder.orderId,amount:360000,currency:'INR',status:'captured' });
    };
    const newSignature = createHmac('sha256',process.env.RAZORPAY_KEY_SECRET!).update(`${newOrder.orderId}|pay_bookingFixture`).digest('hex');
    const verifiedPayment = await verifyPayment(request('/api/razorpay/verify-payment',{ token: result.token,razorpay_order_id:newOrder.orderId,razorpay_payment_id:'pay_bookingFixture',razorpay_signature:newSignature }));
    assert.equal(verifiedPayment.status,200);
    assert.equal((await verifiedPayment.json()).booking.status,'confirmed');
    globalThis.fetch = orderStub;
    assert.equal((await scanQr(request('/api/host/checkin',{ token:result.token }))).status,401);
    const scanned = await scanQr(request('/api/host/checkin',{ token:result.token },true));
    assert.equal(scanned.status,200);
    const checkedBooking = (await scanned.json()).booking;
    assert.equal(checkedBooking.status,'checked_in');
    assert.equal(new Date(checkedBooking.endsAt).getTime()-new Date(checkedBooking.checkedInAt).getTime(),3*3600000,'normal booking timer is not the five-minute trial');
    assert.equal((await finishBooking(request('/api/host/bookings/complete',{},true),bookingContext)).status,200);
    assert.equal((await getBookingByCheckinToken(result.token))?.status,'completed');
    assert.equal((await hostReviews(new Request('http://localhost:3000/api/host/reviews'))).status,401);
    await sql("INSERT INTO venue_reviews(venue_slug,reviewer_name,rating,source,status,comment) VALUES('time-cafe','Fixture received review',4,'self_reported','published','Genuine local fixture'),('time-cafe','Unapproved fixture',5,'self_reported','pending','Not public')");
    const received = await hostReviews(new Request('http://localhost:3000/api/host/reviews', { headers: { authorization: `Basic ${Buffer.from(`curator:${process.env.CURATOR_PASSWORD}`).toString('base64')}` } }));
    assert.equal(received.headers.get('Cache-Control'),'no-store');
    assert.deepEqual((await received.json()).reviews.map((r: { organizerName: string }) => r.organizerName), ['Fixture received review']);
    console.log('PASS: authenticated request → account/host visibility → guarded host approval → exact-price checkout → server payment verification (stubbed gateway) → protected QR check-in → normal three-hour timer → completion; invalid dates/times/guest counts and protected published-only reviews.');
    console.log('PASS: real local PostgreSQL migrations, Time Cafe only, ₹6000 checkout/₹600 commission, curator-only ₹10 trial, 5-minute QR, exact nine-row archive, new requests retained, payment/order/review history preserved, blocked archived actions, overdue suppression, guarded restore and old-price capture rejection. No cloud writes or gateway calls.');
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.__pgPool = previousPool;
    envNames.forEach((name, i) => { if (previousEnv[i] === undefined) delete process.env[name]; else process.env[name] = previousEnv[i]; });
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
