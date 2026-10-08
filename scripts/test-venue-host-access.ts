/** Isolated PostgreSQL security test. No .env, live database, OTP sends or charges. */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Pool } from 'pg';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';
import { HOST_ACCESS_MESSAGE, checkHostAccess, isApprovedHostPhone } from '../lib/venueHostAccess';
import { getVenueUserFromRequest, hashVenueSession, VENUE_SESSION_COOKIE } from '../lib/venueUserAuth';
import { POST as approve, GET as members } from '../app/api/admin/venue-hosts/route';
import { DELETE as revoke } from '../app/api/admin/venue-hosts/[id]/route';
import { POST as sendOtp } from '../app/api/whatsapp/send-otp/route';
import { POST as verifyOtp } from '../app/api/whatsapp/verify-otp/route';
import { PATCH as patchProfile } from '../app/api/venue-auth/me/route';
import { GET as bookings } from '../app/api/host/bookings/route';
import { GET as reviews } from '../app/api/host/reviews/route';
import { GET as menu, PUT as saveMenu } from '../app/api/host/menu/route';
import { POST as extractMenu } from '../app/api/host/menu/extract/route';
import { POST as status } from '../app/api/host/bookings/[id]/status/route';
import { GET as orders, POST as addOrder } from '../app/api/host/bookings/[id]/orders/route';
import { POST as complete } from '../app/api/host/bookings/[id]/complete/route';
import { POST as checkin } from '../app/api/host/checkin/route';
import { GET as hostVenue, PATCH as savePhotos } from '../app/api/host/venue/route';
import { POST as uploadPhoto } from '../app/api/host/venue/photos/route';
import { PATCH as roomPhoto } from '../app/api/host/venue/spaces/[rowId]/route';
import { GET as poster } from '../app/api/poster/[id]/route';
import { GET as adminVenues } from '../app/api/admin/venues/route';
import { POST as adminPoster } from '../app/api/admin/curator/poster/route';
import { MAX_POSTER_BYTES } from '../lib/imageBytes';
import { formatRemaining } from '../components/venues/BookingCountdown';

interface LocalPg {
  exec(sql: string): Promise<unknown>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; affectedRows: number }>;
  close(): Promise<void>;
}

async function main() {
  const modulePath = process.argv.find(arg => arg.startsWith('--pglite='))?.slice(9);
  if (!modulePath?.startsWith('/')) throw new Error('Provide --pglite=/absolute/path/to/@electric-sql/pglite');
  const { PGlite } = createRequire(import.meta.url)(modulePath) as { PGlite: { create(): Promise<LocalPg> } };
  const db = await PGlite.create();
  const oldPool = globalThis.__pgPool, oldFetch = globalThis.fetch;
  const oldCurator = process.env.CURATOR_PASSWORD, oldSecret = process.env.WHATSAPP_OTP_HASH_SECRET;
  process.env.CURATOR_PASSWORD = 'fixture-curator';
  process.env.WHATSAPP_OTP_HASH_SECRET = 'fixture-otp';
  const sql = async (text: string, params?: unknown[]) => {
    const result = await db.query(text, params);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  globalThis.__pgPool = { query: sql, connect: async () => ({ query: sql, release() {} }) } as unknown as Pool;
  globalThis.fetch = async () => { throw new Error('External traffic is forbidden in this test'); };
  const organiserToken = 'a'.repeat(64), forgedHostToken = 'b'.repeat(64);
  const req = (path: string, method = 'GET', body?: object, token?: string, curator = false, crossSite = false) => new Request(`http://localhost:3000${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { cookie: `${VENUE_SESSION_COOKIE}=${token}` } : {}),
      ...(curator ? { authorization: `Basic ${Buffer.from('curator:fixture-curator').toString('base64')}` } : {}),
      ...(crossSite ? { origin: 'https://attacker.invalid', 'sec-fetch-site': 'cross-site' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const context = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
  const otp = async (phone: string) => sql(`INSERT INTO phone_otp_verifications(phone,code_hash,expires_at)
    VALUES($1,$2,now()+interval '10 minutes')`, [phone, createHmac('sha256', 'fixture-otp').update(`${phone}:123456`).digest('hex')]);
  const hostPhone = '919876543210';
  const details = { phone: hostPhone, code: '123456', name: 'Fixture host', role: 'Host', venue: 'Time Cafe' };
  try {
    const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS poster_uploads'), schema.indexOf('CREATE TABLE IF NOT EXISTS clicks')));
    await db.exec(schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS venue_users')));
    await db.exec(readFileSync(new URL('../db/migrations/2026-10-08-venue-host-access.sql', import.meta.url), 'utf8'));
    await sql("INSERT INTO venue_users(id,phone_e164,name,email,role,venue) VALUES(1,'919876543210','Fixture organiser','fixture@example.invalid','Organiser',NULL),(2,'919876543211','Forged host',NULL,'Host','Time Cafe')");
    for (const [id, token] of [[1, organiserToken], [2, forgedHostToken]] as const) await sql("INSERT INTO venue_user_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')", [id, hashVenueSession(token)]);
    await sql("INSERT INTO venues(id,slug,name,area,status,photos) VALUES(1,'time-cafe','Time Cafe','Nungambakkam','live',ARRAY['/venues/original.jpg']),(2,'other-fixture','Other fixture','Test','live',ARRAY['/venues/other.jpg'])");
    await sql("INSERT INTO venue_spaces(id,venue_id,space_key,name,max_guests,community_rate,production_rate,image) VALUES(1,1,'first-floor','First floor',30,2000,2500,'/venues/room.jpg'),(2,2,'other-room','Other room',50,4000,5000,'/venues/other-room.jpg')");
    for (const [id, venue] of [[1, 'time-cafe'], [2, 'other-fixture']] as const) await sql(`INSERT INTO venue_bookings
      (id,code,checkin_token,venue_slug,venue_name,space_id,space_name,event_date,start_time,duration_hours,people,event_type,description,organizer_name,organizer_email,organizer_phone,organizer_user_id,hourly_rate,total)
      VALUES($1,$2,$3,$4,'Fixture venue','first-floor','First floor','2026-10-24','11:00',3,10,'Tech meetup','Isolated fixture','Fixture organiser','fixture@example.invalid',$5,1,2000,6000)`, [id, `SCN-FX${id}`, `token-${id}`, venue, hostPhone]);

    // Client roles, old unapproved host rows, and phone knowledge are not access.
    assert.equal(await checkHostAccess(req('/host', 'GET', undefined, forgedHostToken)), false);
    assert.equal((await getVenueUserFromRequest(req('/host', 'GET', undefined, forgedHostToken)))?.role, 'Organiser');
    assert.equal((await members(req('/api/admin/venue-hosts', 'GET', undefined, organiserToken))).status, 401);
    assert.equal((await approve(req('/api/admin/venue-hosts', 'POST', { phone: hostPhone }, organiserToken))).status, 401);
    assert.equal((await approve(req('/api/admin/venue-hosts', 'POST', { phone: '637916780' }, undefined, true))).status, 400);
    assert.equal((await approve(req('/api/admin/venue-hosts', 'POST', { phone: hostPhone }, undefined, true, true))).status, 403);
    const rejected = await sendOtp(req('/api/whatsapp/send-otp', 'POST', details));
    assert.equal(rejected.status, 403);
    assert.equal((await rejected.json()).error, HOST_ACCESS_MESSAGE);
    await otp(hostPhone); // Genuine organiser OTP may not be repurposed to gain host rights.
    assert.equal((await verifyOtp(req('/api/whatsapp/verify-otp', 'POST', details))).status, 403);
    assert.equal((await sql('SELECT count(*)::int AS n FROM venue_host_access')).rows[0].n, 0);

    assert.equal((await approve(req('/api/admin/venue-hosts', 'POST', { phone: hostPhone, label: 'Fixture team' }, undefined, true))).status, 200);
    assert.equal(await isApprovedHostPhone('+91 98765 43210'), true);
    assert.equal(await checkHostAccess(req('/host')), false, 'approval alone does not create a session');
    assert.equal(await checkHostAccess(req('/host', 'GET', undefined, organiserToken)), false, 'must complete host OTP sign-in');
    const verified = await verifyOtp(req('/api/whatsapp/verify-otp', 'POST', details));
    assert.equal(verified.status, 200);
    const profile = (await verified.json()).profile;
    assert.equal(profile.role, 'Host', 'an existing organiser can sign in as an approved host');
    assert.equal(profile.venue, 'Time Cafe');
    const hostToken = verified.headers.get('set-cookie')!.match(/scene044_venue_session=([a-f0-9]{64})/)![1];
    assert.equal(await checkHostAccess(req('/host', 'GET', undefined, hostToken)), true);
    const hostProxy = await proxy(new NextRequest(req('/host', 'GET', undefined, hostToken)));
    assert.equal(hostProxy.headers.get('x-middleware-next'), '1');
    const adminProxy = await proxy(new NextRequest(req('/admin/curator', 'GET', undefined, hostToken)));
    assert.match(adminProxy.headers.get('location')!, /\/admin\/login/);
    const loggedOutProxy = await proxy(new NextRequest(req('/host')));
    assert.match(loggedOutProxy.headers.get('location')!, /\/host\/login$/);
    assert.equal((await proxy(new NextRequest(req('/host/login')))).headers.get('x-middleware-next'), '1');
    assert.equal((await members(req('/api/admin/venue-hosts', 'GET', undefined, hostToken))).status, 401);
    const list = await members(req('/api/admin/venue-hosts', 'GET', undefined, undefined, true));
    assert.equal(list.headers.get('cache-control'), 'no-store');
    const memberId = (await list.json()).hosts[0].id;

    // The real approved-host session reaches the photo APIs, never admin APIs.
    for (const path of ['/api/host/venue', '/api/host/bookings']) {
      assert.equal((await proxy(new NextRequest(req(path, 'GET', undefined, hostToken)))).headers.get('x-middleware-next'), '1');
    }
    assert.equal((await adminVenues(req('/api/admin/venues', 'GET', undefined, hostToken))).status, 401);
    assert.equal((await adminPoster(req('/api/admin/curator/poster', 'POST', undefined, hostToken))).status, 401);
    const venueRead = await hostVenue(req('/api/host/venue', 'GET', undefined, hostToken));
    assert.equal(venueRead.status, 200);
    assert.equal(venueRead.headers.get('cache-control'), 'no-store');
    const venueData = (await venueRead.json()).venue;
    assert.equal(venueData.slug, 'time-cafe');
    assert.equal(venueData.spaces[0].communityRate, 2000, 'room rates remain whole rupees');
    assert.equal((await hostVenue(req('/api/host/venue?venueSlug=other-fixture', 'GET', undefined, hostToken))).status, 403);
    assert.equal((await savePhotos(req('/api/host/venue', 'PATCH', { photos: [], slug: 'other-fixture' }, hostToken))).status, 400);
    assert.equal((await savePhotos(req('/api/host/venue', 'PATCH', { photos: [], communityRate: 1 }, hostToken))).status, 400);
    assert.equal((await savePhotos(req('/api/host/venue', 'PATCH', { photos: ['/venues/original.jpg'] }, hostToken, false, true))).status, 403);
    assert.equal((await savePhotos(new Request(req('/api/host/venue', 'PATCH', undefined, hostToken), { body: 'null' }))).status, 400);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');
    const upload = (bytes: Uint8Array, token = hostToken) => {
      const form = new FormData();
      form.set('file', new File([new Uint8Array(bytes)], 'photo.jpg', { type: 'image/jpeg' }));
      return uploadPhoto(new Request('http://localhost:3000/api/host/venue/photos', {
        method: 'POST', headers: { cookie: `${VENUE_SESSION_COOKIE}=${token}` }, body: form,
      }));
    };
    assert.equal((await upload(png, forgedHostToken)).status, 403);
    assert.equal((await upload(Buffer.from('<svg><script>alert(1)</script></svg>'))).status, 400, 'declared JPEG cannot hide SVG');
    assert.equal((await upload(new Uint8Array(MAX_POSTER_BYTES + 1))).status, 413);
    const uploaded = await upload(png);
    assert.equal(uploaded.status, 200);
    const image = await uploaded.json();
    assert.equal(image.mime, 'image/png', 'magic bytes override the filename and declared MIME');
    const served = await poster(req(image.url), context(image.id));
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), png);
    const second = await (await upload(png)).json();
    const gallery = [second.url, '/venues/original.jpg', image.url];
    const savedPhotos = await savePhotos(req('/api/host/venue', 'PATCH', { photos: gallery }, hostToken));
    assert.equal(savedPhotos.status, 200);
    assert.deepEqual((await savedPhotos.json()).venue.photos, gallery, 'cover order persists');
    assert.equal((await savePhotos(req('/api/host/venue', 'PATCH', { photos: [image.url, image.url] }, hostToken))).status, 400);
    assert.equal((await savePhotos(req('/api/host/venue', 'PATCH', { photos: ['https://attacker.invalid/image.png'] }, hostToken))).status, 400);
    await sql("INSERT INTO poster_uploads(mime,bytes,byte_size,origin,origin_url) VALUES('image/png',$1,$2,'upload','host-venue:other-fixture')", [png, png.length]);
    assert.equal((await savePhotos(req('/api/host/venue', 'PATCH', { photos: ['/api/poster/3'] }, hostToken))).status, 400, 'another venue owns that photo');
    const roomContext = (id: number) => ({ params: Promise.resolve({ rowId: String(id) }) });
    assert.equal((await roomPhoto(req('/api/host/venue/spaces/2', 'PATCH', { image: image.url }, hostToken), roomContext(2))).status, 404);
    assert.equal((await roomPhoto(req('/api/host/venue/spaces/1', 'PATCH', { image: image.url, communityRate: 1 }, hostToken), roomContext(1))).status, 400);
    const roomSaved = await roomPhoto(req('/api/host/venue/spaces/1', 'PATCH', { image: image.url }, hostToken), roomContext(1));
    assert.equal(roomSaved.status, 200);
    const spaceData = (await roomSaved.json()).space;
    assert.equal(spaceData.image, image.url);
    assert.equal(spaceData.communityRate, 2000);
    assert.equal(spaceData.productionRate, 2500);
    assert.equal(spaceData.maxGuests, 30);
    assert.equal((await sql('SELECT image FROM venue_spaces WHERE id=2')).rows[0].image, '/venues/other-room.jpg');
    const removedPhotos = await savePhotos(req('/api/host/venue', 'PATCH', { photos: [image.url] }, hostToken));
    assert.equal(removedPhotos.status, 200);
    assert.deepEqual((await (await hostVenue(req('/api/host/venue', 'GET', undefined, hostToken))).json()).venue.photos, [image.url]);
    assert.equal((await hostVenue(req('/api/host/venue', 'GET', undefined, undefined, true))).status, 200, 'curator preview still works');
    assert.equal(formatRemaining(8655), '2h 24m left');
    assert.equal(formatRemaining(3599), '59m 59s left');

    assert.equal((await bookings(req('/api/host/bookings', 'GET', undefined, hostToken))).status, 200);
    assert.equal((await bookings(req('/api/host/bookings?venueSlug=other-fixture', 'GET', undefined, hostToken))).status, 401);
    assert.equal((await reviews(req('/api/host/reviews', 'GET', undefined, hostToken))).status, 200);
    assert.equal((await menu(req('/api/host/menu', 'GET', undefined, hostToken))).status, 200);
    const own = await status(req('/api/host/bookings/1/status', 'POST', { status: 'approved' }, hostToken), context(1));
    assert.equal(own.status, 200);
    assert.equal((await status(req('/api/host/bookings/2/status', 'POST', { status: 'approved' }, hostToken), context(2))).status, 401);
    assert.equal((await orders(req('/api/host/bookings/2/orders', 'GET', undefined, hostToken), context(2))).status, 401);
    assert.equal((await addOrder(req('/api/host/bookings/2/orders', 'POST', { description: 'Coffee', amount: 1 }, hostToken), context(2))).status, 401);
    assert.equal((await complete(req('/api/host/bookings/2/complete', 'POST', undefined, hostToken), context(2))).status, 401);
    assert.equal((await checkin(req('/api/host/checkin', 'POST', { token: 'token-2' }, hostToken))).status, 404);
    assert.equal((await status(req('/api/host/bookings/1/status', 'POST', { status: 'cancelled' }, hostToken, false, true), context(1))).status, 401);
    assert.equal((await patchProfile(req('/api/venue-auth/me', 'PATCH', { name: 'Fixture team', venue: 'Other fixture' }, hostToken))).status, 200);
    assert.equal((await getVenueUserFromRequest(req('/host', 'GET', undefined, hostToken)))?.venue, 'Time Cafe');
    await sql("UPDATE venue_bookings SET status='confirmed' WHERE id=1"); // Stubbed captured payment only, never a real charge.
    const scanned = await checkin(req('/api/host/checkin', 'POST', { token: 'token-1' }, hostToken));
    assert.equal(scanned.status, 200);
    const running = (await scanned.json()).booking;
    assert.equal(running.status, 'checked_in');
    assert.equal(new Date(running.endsAt).getTime() - new Date(running.checkedInAt).getTime(), 3 * 3600000);
    assert.equal((await (await checkin(req('/api/host/checkin', 'POST', { token: 'token-1' }, hostToken))).json()).booking.endsAt, running.endsAt, 'repeat scan preserves the clock');
    const itemId = '00000000-0000-4000-8000-000000000001';
    const requestKey = '00000000-0000-4000-8000-000000000002';
    assert.equal((await saveMenu(req('/api/host/menu', 'PUT', { items: [{ id: itemId, name: 'Coffee', category: 'Drinks', pricePaise: 12345, available: true }] }, hostToken))).status, 200);
    const line = await addOrder(req('/api/host/bookings/1/orders', 'POST', { menuItemId: itemId, quantity: 2, requestKey }, hostToken), context(1));
    assert.equal(line.status, 200);
    const orderData = (await line.json()).order;
    assert.equal(orderData.unitPricePaise, 12345, 'menu prices stay in paise');
    assert.equal(orderData.quantity, 2);
    assert.equal((await (await addOrder(req('/api/host/bookings/1/orders', 'POST', { menuItemId: itemId, quantity: 2, requestKey }, hostToken), context(1))).json()).order.id, orderData.id, 'retry does not double-add an order');
    assert.equal((await (await orders(req('/api/host/bookings/1/orders', 'GET', undefined, hostToken), context(1))).json()).orders.length, 1);
    assert.equal((await complete(req('/api/host/bookings/1/complete', 'POST', undefined, hostToken), context(1))).status, 200);
    assert.equal((await complete(req('/api/host/bookings/1/complete', 'POST', undefined, hostToken), context(1))).status, 409);
    assert.equal((await addOrder(req('/api/host/bookings/1/orders', 'POST', { menuItemId: itemId, quantity: 1, requestKey: '00000000-0000-4000-8000-000000000003' }, hostToken), context(1))).status, 409, 'finished session cannot add menu orders');

    await otp(hostPhone);
    assert.equal((await revoke(req(`/api/admin/venue-hosts/${memberId}`, 'DELETE', undefined, hostToken), context(memberId))).status, 401);
    assert.equal((await revoke(req(`/api/admin/venue-hosts/${memberId}`, 'DELETE', undefined, undefined, true), context(memberId))).status, 200);
    assert.equal(await checkHostAccess(req('/host', 'GET', undefined, hostToken)), false, 'issued host sessions lose access immediately');
    assert.equal((await getVenueUserFromRequest(req('/host', 'GET', undefined, hostToken)))?.role, 'Organiser');
    assert.equal((await hostVenue(req('/api/host/venue', 'GET', undefined, hostToken))).status, 403);
    assert.equal((await savePhotos(req('/api/host/venue', 'PATCH', { photos: [] }, hostToken))).status, 403);
    assert.equal((await upload(png)).status, 403);
    assert.equal((await roomPhoto(req('/api/host/venue/spaces/1', 'PATCH', { image: image.url }, hostToken), roomContext(1))).status, 403);
    assert.equal((await verifyOtp(req('/api/whatsapp/verify-otp', 'POST', details))).status, 403, 'revoked approval cannot finish an outstanding OTP');
    assert.equal((await sql('SELECT count(*)::int AS n FROM venue_bookings')).rows[0].n, 2, 'access removal never deletes bookings');
    assert.equal((await sql('SELECT count(*)::int AS n FROM venue_users')).rows[0].n, 2, 'accounts stay saved');
    // All host handlers must independently deny a removed/forged host.
    for (const [path, method, handler] of [
      ['/api/host/bookings', 'GET', bookings], ['/api/host/reviews', 'GET', reviews],
      ['/api/host/menu', 'GET', menu], ['/api/host/menu', 'PUT', saveMenu],
      ['/api/host/menu/extract', 'POST', extractMenu], ['/api/host/checkin', 'POST', checkin],
    ] as const) assert.equal((await handler(req(path, method, undefined, hostToken))).status, 401, path);
    for (const [path, method, handler] of [
      ['/api/host/bookings/1/status', 'POST', status], ['/api/host/bookings/1/orders', 'GET', orders],
      ['/api/host/bookings/1/orders', 'POST', addOrder], ['/api/host/bookings/1/complete', 'POST', complete],
    ] as const) assert.equal((await handler(req(path, method, undefined, hostToken), context(1))).status, 401, path);
    assert.equal((await approve(req('/api/admin/venue-hosts', 'POST', { phone: hostPhone, label: 'Reapproved' }, undefined, true))).status, 200);
    assert.equal((await sql('SELECT count(*)::int AS n FROM venue_host_access')).rows[0].n, 1, 'duplicate approval restores the same access record');
    await sql("UPDATE venue_user_sessions SET expires_at=now()-interval '1 minute'");
    assert.equal(await checkHostAccess(req('/host', 'GET', undefined, hostToken)), false);
    assert.equal(await checkHostAccess(req('/host', 'GET', undefined, undefined, true)), true, 'curator access remains independent');
    console.log('PASS: approved-host OTP/session, host/admin separation, gallery upload/serve/save/reorder/remove, magic-byte validation and size limits, photo ownership, scoped room edit with intact rates/capacity, QR clock + repeat scan, menu-order snapshots + retry, completion, revocation, expiry and countdown format. No cloud writes, OTP messages or payments.');
  } finally {
    globalThis.__pgPool = oldPool; globalThis.fetch = oldFetch;
    if (oldCurator === undefined) delete process.env.CURATOR_PASSWORD; else process.env.CURATOR_PASSWORD = oldCurator;
    if (oldSecret === undefined) delete process.env.WHATSAPP_OTP_HASH_SECRET; else process.env.WHATSAPP_OTP_HASH_SECRET = oldSecret;
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
