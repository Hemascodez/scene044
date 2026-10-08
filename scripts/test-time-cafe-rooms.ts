/** Isolated catalog migration tests: no .env, live DB, payments or messages. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import type { Pool } from 'pg';
import { getCatalogVenue } from '../lib/venueCatalog';
import { TIME_CAFE, rateForSpace } from '../lib/venues';
import { matchingSpaces } from '../lib/venueSearch';
import { venueRoomPhotos } from '../lib/venueRoomPhotos';

async function main() {
  const modulePath = process.argv.find(arg => arg.startsWith('--pglite='))?.slice(9);
  assert.ok(modulePath?.startsWith('/'), 'Pass an absolute --pglite path');
  const { PGlite } = createRequire(import.meta.url)(modulePath!);
  const db = await PGlite.create();
  const originalPool = globalThis.__pgPool;
  const sql = async (text: string, params?: unknown[]) => {
    const result = await db.query(text, params);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  globalThis.__pgPool = { query: sql } as unknown as Pool;
  try {
    const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS venues ('), schema.indexOf('-- ---------------------------------------------------------- Open venue reviews')));
    await sql("INSERT INTO venues(slug,name,area,status) VALUES('time-cafe','Time Cafe','Nungambakkam','live'),('other','Other cafe','Other','live')");
    // Preserve a historical booking even when its old catalog option retires.
    await db.exec("CREATE TABLE fixture_bookings(space_id text, space_name text, total integer); INSERT INTO fixture_bookings VALUES('small-table','Small talk table',1200)");
    const oldRooms = [
      ['first-floor', 'First-floor event space', 30, 2000, 1000, '/venues/time-cafe/first-floor-wide.jpeg'],
      ['terrace', 'Open-air terrace', 30, null, null, '/venues/time-cafe/terrace.jpeg'],
      ['standard-table', 'Conversation table', 4, 500, 300, '/venues/time-cafe/small-table.jpeg'],
      ['small-table', 'Small talk table', 3, 400, 200, '/venues/time-cafe/small-table.jpeg'],
    ];
    for (const [key, name, guests, community, production, image] of oldRooms) {
      await sql('INSERT INTO venue_spaces(venue_id,space_key,name,max_guests,community_rate,production_rate,image) VALUES(1,$1,$2,$3,$4,$5,$6)', [key,name,guests,community,production,image]);
    }
    await sql("INSERT INTO venue_spaces(venue_id,space_key,name,max_guests,image) VALUES(2,'other-room','Other room',100,'/api/poster/88')");
    const migration = readFileSync(new URL('../db/migrations/2026-10-08-time-cafe-rooms.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    const venue = (await getCatalogVenue('time-cafe'))!;
    assert.deepEqual(venue.spaces.map(s => s.id), ['first-floor','korean-table','standard-table','terrace']);
    for (const room of venue.spaces) {
      const approved = TIME_CAFE.spaces.find(s => s.id === room.id)!;
      for (const field of ['name','eyebrow','description','capacity','maxGuests','image','communityRate','productionRate','minimumFoodSpend'] as const) {
        assert.deepEqual(room[field], approved[field], `${room.id}: ${field}`);
      }
      assert.ok(existsSync(new URL(`../public${room.image}`, import.meta.url)), `${room.id}: photo exists`);
      assert.equal(rateForSpace(room, 'Workshop'), approved.communityRate);
      assert.equal(rateForSpace(room, 'Photoshoot'), approved.productionRate);
    }
    assert.equal(matchingSpaces(venue.spaces,'50').length,0);
    assert.deepEqual(matchingSpaces(venue.spaces,'25').map(s => s.id),['first-floor']);
    assert.deepEqual(matchingSpaces(venue.spaces,'8').map(s => s.id),['first-floor','korean-table','terrace']);
    assert.equal((await sql('SELECT * FROM fixture_bookings')).rows[0].total,1200);
    assert.equal((await sql("SELECT jsonb_array_length(previous_spaces) AS count FROM venue_catalog_content_updates")).rows[0].count,4);
    assert.equal((await getCatalogVenue('other'))!.spaces[0].image,'/api/poster/88');

    // Later edits must survive every deploy, including a host's replacement.
    await sql("UPDATE venue_spaces SET image='/api/poster/77',description='Host edited copy',community_rate=2200 WHERE venue_id=1 AND space_key='first-floor'");
    await db.exec(migration);
    const edited = (await getCatalogVenue('time-cafe'))!.spaces[0];
    assert.equal(edited.image,'/api/poster/77');
    assert.equal(edited.description,'Host edited copy');
    assert.equal(edited.communityRate,2200);
    // Already-uploaded photos also survive the initial correction.
    await sql("DELETE FROM venue_catalog_content_updates WHERE key='time-cafe-approved-rooms-2026-10-08'");
    await db.exec(migration);
    assert.equal((await getCatalogVenue('time-cafe'))!.spaces[0].image,'/api/poster/77');

    const album = [{src:'/venues/first.jpg',alt:'First view'},{src:'/venues/second.jpg',alt:'Second view'}];
    assert.deepEqual(venueRoomPhotos('/api/poster/77','Room',album),[{src:'/api/poster/77',alt:'Room'}]);
    assert.deepEqual(venueRoomPhotos('/venues/second.jpg','Room',album).map(p => p.src),['/venues/second.jpg','/venues/first.jpg']);
    assert.deepEqual(venueRoomPhotos('','Room',album),album);
    assert.deepEqual(venueRoomPhotos('','New room'),[]);
    console.log('PASS: approved four-room catalog, real prices/capacities, photo files, search, history backup, retirement, idempotency and host-photo precedence.');
  } finally {
    globalThis.__pgPool = originalPool;
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
