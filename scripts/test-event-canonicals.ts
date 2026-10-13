/** Isolated PostgreSQL only. No production data or external network writes. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Pool } from 'pg';
import { getPublicEventById, getPublicEvents, getPublicEventSitemapEntries } from '../lib/events';
import { findDuplicateEvent, sameNamedEventAtVenue } from '../lib/dedup';
import { eventDateRangeNeedsReview } from '../lib/eventDates';
import { eventPath } from '../lib/seo';

async function main() {
  const modulePath = process.argv.find(arg => arg.startsWith('--pglite='))?.slice(9);
  if (!modulePath?.startsWith('/')) throw new Error('Provide --pglite=/absolute/package/path');
  const { PGlite } = createRequire(import.meta.url)(modulePath);
  const db = await PGlite.create();
  const previousPool = globalThis.__pgPool;
  const sql = async (text: string, params?: unknown[]) => {
    const result = await db.query(text, params);
    return { ...result, rowCount: /^\s*SELECT\b/i.test(text) ? result.rows.length : result.affectedRows };
  };
  globalThis.__pgPool = { query: sql } as unknown as Pool;
  try {
    await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
    await sql(`INSERT INTO events(id,title,category,start_at,end_at,venue_name,organizer_name,primary_source_url,source_type,status)
      VALUES(23,'DevFest 2026 Chennai','tech','2026-10-17T03:00Z','2027-10-17T13:00Z','IIT Madras Research Park','Google Developer Groups','https://gdg.community.dev/old-event','auto','expired'),
      (89,'DevFest Chennai 2026','tech','2026-10-17T03:00Z',NULL,'IITM Research Park','GDG Chennai','https://devfest.gdgchennai.in/tickets','auto','live'),
      (90,'Different event','tech','2099-10-17T03:00Z',NULL,'Different venue',NULL,'https://example.com/other','curator','live')`);
    const migration = readFileSync(new URL('../db/migrations/2026-10-13-event-canonicals.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const canonical = await getPublicEventById(23);
    assert.ok(canonical);
    assert.equal(canonical.endAt, null);
    assert.equal(canonical.status, 'live');
    assert.equal(canonical.organizerName, 'GDG Chennai');
    assert.equal(canonical.primarySourceUrl, 'https://devfest.gdgchennai.in/tickets');
    assert.equal((await getPublicEventById(89))?.id, 23);
    assert.equal(eventPath((await getPublicEventById(89))!), '/events/devfest-2026-chennai-23');
    assert.deepEqual((await getPublicEventSitemapEntries()).map(e => e.id), [23, 90]);
    assert.equal((await getPublicEvents(null)).some(e => e.id === 89), false);
    assert.equal((await sql('SELECT count(*)::int AS n FROM events')).rows[0].n, 3, 'records were preserved');
    assert.equal((await sql('SELECT count(*)::int AS n FROM event_seo_corrections')).rows[0].n, 2, 'recoverable backups and idempotent migration');
    assert.equal((await sql("SELECT original_row->>'end_at' AS original FROM event_seo_corrections WHERE correction_key='devfest-2026-end-date'")).rows[0].original.includes('2027'), true);
    const candidate = { title: 'DevFest Chennai 2026', startAt: '2026-10-17T03:00Z', isOnline: false, venueName: 'IITM Research Park', organizerName: 'GDG Chennai', category: 'tech' as const, url: 'https://devfest.gdgchennai.in/tickets' };
    assert.equal((await findDuplicateEvent(candidate))?.eventId, 23);
    const row = { id: 23, title: 'DevFest 2026 Chennai', start_at: candidate.startAt, is_online: false, venue_name: 'IIT Madras Research Park', organizer_name: null, primary_source_url: 'https://example.com' };
    assert.equal(sameNamedEventAtVenue(candidate, row), true);
    assert.equal(sameNamedEventAtVenue({ ...candidate, title: 'DevFest Chennai 2027' }, row), false);
    assert.equal(sameNamedEventAtVenue({ ...candidate, startAt: '2026-10-17T08:00Z' }, row), false);
    assert.equal(sameNamedEventAtVenue({ ...candidate, venueName: 'Another campus' }, row), false);
    assert.equal(eventDateRangeNeedsReview('2026-10-17T03:00Z', '2027-10-17T13:00Z'), true);
    assert.equal(eventDateRangeNeedsReview('2026-10-17T03:00Z', '2026-10-17T13:00Z'), false);
    // Replaying startup must not overwrite a later curator edit.
    await sql("UPDATE events SET organizer_name='Later curator edit' WHERE id=23");
    await db.exec(migration);
    assert.equal((await getPublicEventById(23))?.organizerName, 'Later curator edit');
    console.log('PASS canonical event merge, preserved history, repeat-safe correction, future dedup and date-review guards');
  } finally {
    globalThis.__pgPool = previousPool;
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
