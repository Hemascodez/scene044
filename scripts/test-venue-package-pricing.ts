/** Isolated PostgreSQL and stubbed gateway: no production bookings or payments.
 * Run with --pglite=/absolute/path/to/@electric-sql/pglite. */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Pool } from 'pg';
import { POST as submit, GET as account } from '../app/api/venue-bookings/route';
import { POST as createOrder } from '../app/api/razorpay/create-order/route';
import { POST as verifyPayment } from '../app/api/razorpay/verify-payment/route';
import { PUT as saveDraft, GET as readDraft } from '../app/api/venue-booking-drafts/route';
import { PATCH as changePricing } from '../app/api/admin/venues/[slug]/spaces/[rowId]/pricing/route';
import { getCatalogVenue, venueEarnings } from '../lib/venueCatalog';
import { getBookingByCheckinToken, checkInBooking, listVenueBookings } from '../lib/venueBookings';
import { bookingFinancials, quoteSpace, packageTotal, publicSpacePricing, parseSpacePricing } from '../lib/venuePricing';
import { hashVenueSession, VENUE_SESSION_COOKIE } from '../lib/venueUserAuth';
import { rateForSpace, venueFromRate } from '../lib/venues';

async function main() {
  const modulePath = process.argv.find(arg => arg.startsWith('--pglite='))?.slice(9);
  if (!modulePath?.startsWith('/')) throw new Error('Provide --pglite=/absolute/package/path');
  const { PGlite } = createRequire(import.meta.url)(modulePath);
  const db = await PGlite.create();
  const previousPool = globalThis.__pgPool;
  const previousFetch = globalThis.fetch;
  const envKeys = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'CURATOR_PASSWORD', 'WHATSAPP_VENUE_NOTIFICATIONS_ENABLED'] as const;
  const previousEnv = envKeys.map(key => process.env[key]);
  process.env.RAZORPAY_KEY_ID = 'rzp_test_fixture';
  process.env.RAZORPAY_KEY_SECRET = 'fixture-secret';
  process.env.CURATOR_PASSWORD = 'fixture-curator';
  process.env.WHATSAPP_VENUE_NOTIFICATIONS_ENABLED = 'false';
  const sql = async (text: string, params?: unknown[]) => {
    const result = await db.query(text, params);
    return { ...result, rowCount: /^\s*SELECT\b/i.test(text) ? result.rows.length : result.affectedRows };
  };
  globalThis.__pgPool = { query: sql, connect: async () => ({ query: sql, release() {} }) } as unknown as Pool;
  const session = 'c'.repeat(64);
  const req = (path: string, body?: Record<string, unknown>, curator = false) => new Request(`http://localhost:3000${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', cookie: `${VENUE_SESSION_COOKIE}=${session}`,
      ...(curator ? { authorization: `Basic ${Buffer.from('curator:fixture-curator').toString('base64')}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let gatewayCalls = 0;
  let charged = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/orders')) {
      gatewayCalls++;
      charged = JSON.parse(String(init?.body)).amount;
      return Response.json({ id: 'order_pricing', amount: charged, currency: 'INR', status: 'created' });
    }
    assert.equal(url, 'https://api.razorpay.com/v1/payments/pay_pricing');
    return Response.json({ id: 'pay_pricing', order_id: 'order_pricing', amount: charged, currency: 'INR', status: 'captured' });
  };
  try {
    const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS venue_users'), schema.indexOf('ALTER TABLE venue_bookings ADD COLUMN IF NOT EXISTS archived_at')));
    await db.exec(readFileSync(new URL('../db/migrations/2026-10-07-venue-booking-archive.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../db/migrations/2026-10-08-venue-host-access.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../db/migrations/2026-10-08-multi-venue-host-access.sql', import.meta.url), 'utf8'));
    await sql("INSERT INTO venue_users(id,phone_e164,name,email) VALUES(1,'919876543210','Pricing fixture','fixture@example.invalid')");
    await sql("INSERT INTO venue_user_sessions(user_id,token_hash,expires_at) VALUES(1,$1,now()+interval '1 day')", [hashVenueSession(session)]);
    await sql("INSERT INTO venues(id,slug,name,area,status) VALUES(1,'chennai-yoga-studio','Yoga studio','Kilpauk','live'),(2,'time-cafe','Time Cafe','Nungambakkam','live')");
    await sql("INSERT INTO venue_spaces(venue_id,space_key,name,max_guests,community_rate,production_rate) VALUES(1,'yoga-wellness-studio','Studio',25,2000,2000),(2,'first-floor','First floor',30,2000,2000)");
    const migration = readFileSync(new URL('../db/migrations/2026-10-12-venue-package-pricing.sql', import.meta.url), 'utf8');
    await db.exec(migration); await db.exec(migration);
    const venue = (await getCatalogVenue('chennai-yoga-studio'))!;
    assert.equal(venueFromRate(venue), 2200);
    assert.equal(rateForSpace(venue.spaces[0], 'Art workshop'), 2200);
    assert.deepEqual(venue.spaces[0].pricing?.packages.map(p => [p.price, p.listPrice]), [[7700,8800],[13200,17600]]);
    const config = parseSpacePricing({ minHours:2, markupBasisPoints:1000, packages:[] });
    assert.equal(quoteSpace(2005,config,2).total,packageTotal(publicSpacePricing(2005,config)!,'hourly',2),'round hourly prices once, identically in UI/server');
    const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10);
    const base = { venueSlug: 'chennai-yoga-studio', spaceId: 'yoga-wellness-studio', eventType: 'Art workshop',
      date: future, time: '09:00', duration: 2, people: 10, description: 'Isolated pricing test', packageId: 'hourly', expectedTotal: 4400 };
    assert.equal((await submit(new Request('http://localhost/api/venue-bookings',{ method:'POST', body:JSON.stringify(base) }))).status,401);
    for (const [patch, expected] of [
      [{ duration: 1, expectedTotal: 2200 },400], [{ packageId: 'missing' },400],
      [{ packageId:'half-day',duration:2,expectedTotal:7700 },400], [{ packageId:123 },400],
      [{ expectedTotal:1 },409], [{ packageId:undefined,expectedTotal:undefined },409],
      [{ venueSlug:'time-cafe',spaceId:'first-floor',packageId:'half-day',duration:4 },400],
      [{ packageId:'full-day',duration:8,expectedTotal:13200,time:'20:00' },400],
    ] as [Record<string, unknown>, number][]) assert.equal((await submit(req('/api/venue-bookings',{...base,...patch}))).status,expected,JSON.stringify(patch));
    const entries = [];
    for (const [packageId,duration,total,hostAmount,sceneAmount] of [['hourly',2,4400,4000,400],['half-day',4,7700,7000,700],['full-day',8,13200,12000,1200]] as const) {
      const result = await submit(req('/api/venue-bookings',{...base,packageId,duration,expectedTotal:total,total:1,hourlyRate:1}));
      assert.equal(result.status,200);
      const data = await result.json();
      assert.equal(data.total,total);
      const stored = (await getBookingByCheckinToken(data.token))!;
      assert.equal(stored.packageId,packageId);
      assert.equal(stored.durationHours,duration);
      assert.deepEqual(bookingFinancials(stored),{total,sceneFee:sceneAmount,payout:hostAmount});
      entries.push(data);
    }
    const publicEntries = (await (await account(req('/api/venue-bookings'))).json()).entries;
    assert.equal(publicEntries.length,3);
    for (const e of publicEntries) for (const key of ['sceneAmount','hostAmount','pricingModel']) assert.equal(key in e.booking,false,'private settlement amounts');
    assert.equal((await listVenueBookings('chennai-yoga-studio')).length,3,'host sees persisted requests');
    const draft = { venueSlug:base.venueSlug,spaceId:base.spaceId,formData:{kind:'figma',packageId:'half-day',hours:2},editedAtMs:Date.now() };
    assert.equal((await saveDraft(new Request(req('/api/venue-booking-drafts',draft),{method:'PUT'}))).status,200);
    assert.equal((await (await readDraft(req('/api/venue-booking-drafts?venueSlug=chennai-yoga-studio'))).json()).draft.formData.packageId,'half-day');
    const full = entries[2];
    assert.equal((await createOrder(req('/api/razorpay/create-order',{token:full.token}))).status,409);
    assert.equal(gatewayCalls,0,'no gateway request before approval');
    await sql("UPDATE venue_bookings SET status='approved' WHERE id=$1",[full.id]);
    // Editing live prices must not alter a saved agreement or checkout.
    const altered = { minHours:2,markupBasisPoints:1000,packages:[{id:'half-day',name:'Half-day',hours:4,basePrice:8000},{id:'full-day',name:'Full-day',hours:8,basePrice:13000}] };
    const editContext = {params:Promise.resolve({slug:'chennai-yoga-studio',rowId:String(venue.spaces[0].rowId)})};
    assert.equal((await changePricing(new Request(req('/pricing',{pricing:altered}),{method:'PATCH'}),editContext)).status,401);
    assert.equal((await changePricing(new Request(req('/pricing',{pricing:altered},true),{method:'PATCH'}),editContext)).status,200);
    await db.exec(migration);
    assert.equal((await getCatalogVenue(base.venueSlug))?.spaces[0].pricing?.packages[1].price,14300,'restart preserves curator pricing edits');
    await sql('UPDATE venue_spaces SET community_rate=NULL, production_rate=NULL WHERE venue_id=1');
    const order = await createOrder(req('/api/razorpay/create-order',{token:full.token,amount:1}));
    assert.equal(order.status,200);
    assert.equal((await order.json()).amount,1320000,'full price, no advance, immutable snapshot');
    const payment = await verifyPayment(req('/api/razorpay/verify-payment',{token:full.token,razorpay_order_id:'order_pricing',razorpay_payment_id:'pay_pricing',razorpay_signature:createHmac('sha256','fixture-secret').update('order_pricing|pay_pricing').digest('hex')}));
    assert.equal(payment.status,200);
    const confirmed = (await payment.json()).booking;
    assert.equal(confirmed.status,'confirmed');
    assert.equal('hostAmount' in confirmed,false);
    const earnings = await venueEarnings(base.venueSlug);
    assert.equal(earnings.grossValue,13200);assert.equal(earnings.sceneFee,1200);assert.equal(earnings.venuePayout,12000);
    const checked = await checkInBooking(full.id);
    assert.equal(new Date(checked!.endsAt!).getTime()-new Date(checked!.checkedInAt!).getTime(),8*3600000,'package duration drives QR timer');
    const legacy = await submit(req('/api/venue-bookings',{...base,venueSlug:'time-cafe',spaceId:'first-floor',packageId:'hourly',duration:1,expectedTotal:2000}));
    assert.equal(legacy.status,200);
    assert.equal((await legacy.json()).total,2000);
    console.log('PASS: database prices, packages, minimum, tampering/stale-price guards, private settlement snapshots, saved drafts, full Razorpay payment (stubbed), payout accounting, immutable pricing and package QR duration; Time Cafe unchanged.');
  } finally {
    globalThis.fetch=previousFetch;globalThis.__pgPool=previousPool;
    envKeys.forEach((key,i)=>{if(previousEnv[i]===undefined)delete process.env[key];else process.env[key]=previousEnv[i]});
    await db.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});
