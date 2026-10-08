/** No database, live requests, messages or charges. */
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { GET } from '../app/api/admin/venue-bookings/route';
import { readCuratorBookingList, readCuratorBookingResponse } from '../lib/client/curatorBookingResponse';

async function main() {
  const oldPool = globalThis.__pgPool, oldPassword = process.env.CURATOR_PASSWORD;
  const oldConsoleError = console.error;
  process.env.CURATOR_PASSWORD = 'fixture-curator';
  const req = (query = '', authenticated = true) => new Request(`http://localhost:3000/api/admin/venue-bookings${query}`, {
    headers: authenticated ? { authorization: `Basic ${Buffer.from('curator:fixture-curator').toString('base64')}` } : {},
  });
  try {
    assert.equal((await GET(req('', false))).status, 401);
    assert.equal((await GET(req('?page=0'))).status, 400);
    assert.equal((await GET(req('?page=1.5'))).status, 400);
    const diagnostics: unknown[][] = [];
    console.error = (...args) => { diagnostics.push(args); };
    globalThis.__pgPool = { query: async () => { throw Object.assign(new Error('private database details'), { code: '42703' }); } } as unknown as Pool;
    const failed = await GET(req());
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('Cache-Control'), 'no-store');
    assert.equal((await failed.json()).error, 'Bookings are temporarily unavailable. Please retry.');
    assert.deepEqual(diagnostics, [['Curator bookings unavailable', '42703']], 'logs exclude customer/connection details');
    for (const response of [new Response('', { status: 500 }), new Response('<html>Server error</html>', { status: 502 }), Response.json({ error: 'private failure' }, { status: 503 })]) {
      await assert.rejects(readCuratorBookingList(response), /Bookings are temporarily unavailable\. Please retry\./);
    }
    for (const response of [new Response(''), new Response('<html>Not JSON</html>'), Response.json(null), Response.json({}), Response.json({ bookings: [], count: -1, page: 1 }), Response.json({ bookings: [{}], count: 1, page: 1 })]) {
      await assert.rejects(readCuratorBookingList(response), /Could not load bookings\. Please retry\./);
    }
    await assert.rejects(readCuratorBookingList(new Response('', { status: 401 })), /session expired/);
    await assert.rejects(readCuratorBookingList(new Response('', { status: 403 })), /permission/);
    await assert.rejects(readCuratorBookingResponse(new Response('', { status: 200 }), 'Update failed. Refresh before retrying.'), /Update failed/);
    await assert.rejects(readCuratorBookingResponse(Response.json({ error: 'Only unpaid bookings qualify.' }, { status: 409 }), 'Update failed.'), /Only unpaid/);
    const row = { id: 1, code: 'SCN-FIXTURE', status: 'requested', organizerName: 'Fixture organiser' };
    globalThis.__pgPool = { query: async (sql: string) => ({ rows: sql.includes('COUNT(*)') ? [{ count: 1 }] : [row] }) } as unknown as Pool;
    const success = await GET(req());
    assert.equal(success.status, 200);
    assert.deepEqual(await readCuratorBookingList(success), { bookings: [row], count: 1, page: 1 });
    assert.deepEqual(await readCuratorBookingList(Response.json({ bookings: [], count: 0, page: 1 })), { bookings: [], count: 0, page: 1 });
    console.log('PASS: curator auth/page validation, database failure returns safe JSON 503, no sensitive diagnostics, empty/HTML/malformed responses handled, session-expiry guidance, valid bookings and honest empty state. No live operations.');
  } finally {
    globalThis.__pgPool = oldPool; console.error = oldConsoleError;
    if (oldPassword === undefined) delete process.env.CURATOR_PASSWORD; else process.env.CURATOR_PASSWORD = oldPassword;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
