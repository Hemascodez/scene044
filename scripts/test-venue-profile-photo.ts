/** In-memory SQL fixture only: no real accounts, photos or sessions are modified. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { GET, POST, DELETE } from '../app/api/venue-auth/photo/route';
import { hashVenueSession, VENUE_SESSION_COOKIE } from '../lib/venueUserAuth';

async function main() {
  const tokens = ['a'.repeat(64), 'b'.repeat(64)];
  const photos = new Map<number, Buffer>();
  const previous = globalThis.__pgPool;
  globalThis.__pgPool = { query: async (sql: string, params: unknown[]) => {
    if (sql.includes('FROM venue_user_sessions')) {
      const index = tokens.findIndex(token => hashVenueSession(token) === params[0]);
      return { rows: index < 0 ? [] : [{ id: index + 1 }] };
    }
    if (sql.startsWith('SELECT bytes')) return { rows: photos.has(params[0] as number) ? [{ bytes: photos.get(params[0] as number) }] : [] };
    if (sql.includes('INSERT INTO venue_user_photos')) photos.set(params[0] as number, params[1] as Buffer);
    else if (sql.includes('DELETE FROM venue_user_photos')) photos.delete(params[0] as number);
    else throw new Error(`Unexpected SQL: ${sql}`);
    return { rows: [] };
  }} as unknown as Pool;
  const request = (method: string, user?: number, data?: Uint8Array, mime = 'image/jpeg') => {
    const headers = new Headers();
    if (user !== undefined) headers.set('cookie', `${VENUE_SESSION_COOKIE}=${tokens[user]}`);
    const body = data ? new FormData() : undefined;
    if (body && data) {
      body.set('photo', new Blob([new Uint8Array(data)], { type: mime }), 'photo.jpg');
      headers.set('content-length', String(data.length + 300));
    }
    return new Request('http://localhost:3000/api/venue-auth/photo', { method, headers, body });
  };
  try {
    for (const handler of [GET, POST, DELETE]) assert.equal((await handler(request(handler === GET ? 'GET' : handler === POST ? 'POST' : 'DELETE'))).status, 401);
    assert.equal((await GET(request('GET', 0))).status, 404, 'new account has no default photo');
    assert.equal((await POST(request('POST', 0, new Uint8Array([1,2,3,4])))).status, 400);
    assert.equal((await POST(request('POST', 0, new Uint8Array(524289)))).status, 413);
    const jpeg = new Uint8Array([255,216,255,224,255,217]);
    assert.equal((await POST(request('POST', 0, jpeg, 'image/svg+xml'))).status, 400);
    const crossSite = request('DELETE', 0);
    crossSite.headers.set('sec-fetch-site', 'cross-site');
    assert.equal((await DELETE(crossSite)).status, 403);
    assert.equal((await POST(request('POST', 0, jpeg))).status, 200);
    const stored = await GET(request('GET', 0));
    assert.equal(stored.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(new Uint8Array(await stored.arrayBuffer()), jpeg, 'new request reads saved account photo');
    assert.equal((await GET(request('GET', 1))).status, 404, 'another account cannot see this photo');
    assert.equal((await DELETE(request('DELETE', 1))).status, 200);
    assert.equal((await GET(request('GET', 0))).status, 200, 'another account cannot remove this photo');
    assert.equal((await DELETE(request('DELETE', 0))).status, 200);
    assert.equal((await GET(request('GET', 0))).status, 404);
    const ui = readFileSync(new URL('../components/venues/figma/MyBookings.tsx', import.meta.url), 'utf8');
    assert.ok(!ui.includes('profile-9d83e.jpg') && !ui.includes('PHOTO_KEY_PREFIX'));
    console.log('PASS: no mock avatar, authenticated photo save/read/delete, account isolation, private caching, size/type rejection.');
  } finally { globalThis.__pgPool = previous; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
