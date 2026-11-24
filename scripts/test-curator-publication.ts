import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { POST as approve } from '../app/api/admin/curator/approve/route';
import { POST as changeStatus } from '../app/api/admin/curator/item-status/route';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function main() {
  const previousPool = globalThis.__pgPool;
  const previousPassword = process.env.CURATOR_PASSWORD;
  const previousFetch = globalThis.fetch;
  const db = new PGlite(); // In-memory only: never opens DATABASE_URL.
  const clients: { released: boolean; active: boolean }[] = [];
  let failWrite: 'source' | 'status' | null = null;
  let failedWrites = 0;
  let hold: { locked: ReturnType<typeof deferred>; resume: ReturnType<typeof deferred>;
    waiting: ReturnType<typeof deferred>; done: ReturnType<typeof deferred>; held: boolean } | undefined;
  const headers = { Authorization: `Basic ${btoa('curator:publication-fixture-password')}`,
    'Content-Type': 'application/json' };
  const request = (body: unknown) => new Request('http://localhost/api/admin/curator/test', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const sql = async (text: string, values?: unknown[]) => {
    const result = await db.query<Record<string, unknown>>(text, values);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  const draft = (id: number) => ({ discoveryItemId: id, title: 'Fixture community workshop',
    summary: 'Builders discuss their software projects and exchange practical engineering experiences.',
    category: 'tech', startAt: '2099-12-01T10:00:00+05:30', endAt: '2099-12-01T12:00:00+05:30',
    isOnline: false, venueName: 'Fixture Hall', venueAddress: '1 Fixture Road, Mumbai, Maharashtra',
    city: 'Mumbai', organizerName: 'Fixture Community', posterImageUrl: null,
    priceType: null, chennaiRelevanceScore: 0, status: 'live',
  });
  const reset = async (status = 'curator_pending') => {
    await db.exec('DELETE FROM event_sources; UPDATE discovery_items SET event_id=NULL; DELETE FROM events; DELETE FROM discovery_items');
    const result = await sql(`INSERT INTO discovery_items(url,source_domain,status,origin,curator_draft)
      VALUES('https://luma.com/publication-fixture','luma.com',$1,'search','{"title":"Saved draft"}') RETURNING id`, [status]);
    return Number(result.rows[0].id);
  };
  const snapshot = async (id: number) => ({
    item: (await sql('SELECT status,event_id,rejection_reason,curator_draft FROM discovery_items WHERE id=$1', [id])).rows[0],
    events: (await sql('SELECT id,title,status FROM events ORDER BY id')).rows,
    sources: (await sql('SELECT event_id,source_url,discovery_item_id FROM event_sources ORDER BY id')).rows,
  });

  try {
    process.env.CURATOR_PASSWORD = 'publication-fixture-password';
    globalThis.fetch = async () => { throw new Error('External requests forbidden in publication tests'); };
    await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
    globalThis.__pgPool = {
      query: async (text: string, values?: unknown[]) => {
        // PGlite has one connection. Model PostgreSQL's competing-session row
        // lock here; the real handler's UPDATE predicates still execute in SQL.
        if (hold?.held && /^\s*UPDATE discovery_items SET status/i.test(text)) {
          const current = hold;
          current.waiting.resolve();
          await current.done.promise;
        }
        return sql(text, values);
      },
      connect: async () => {
        const client = { released: false, active: false };
        clients.push(client);
        return {
          query: async (text: string, values?: unknown[]) => {
            assert.equal(client.released, false, 'no queries after releasing a client');
            if (/^\s*BEGIN\b/i.test(text)) client.active = true;
            if (/^\s*(INSERT|UPDATE|DELETE)\b/i.test(text)) assert.equal(client.active, true, 'publication writes share the transaction');
            if ((failWrite === 'source' && /INSERT INTO event_sources/.test(text))
              || (failWrite === 'status' && /UPDATE discovery_items SET status/.test(text))) {
              failedWrites++;
              throw new Error('Injected publication write failure');
            }
            const result = await sql(text, values);
            if (/^\s*SELECT\b[\s\S]*FROM discovery_items\b/.test(text)) {
              assert.equal(client.active, true);
              assert.match(text, /FOR UPDATE\b/, 'read current review state under the row lock');
              if (hold) {
                hold.held = true;
                hold.locked.resolve();
                await hold.resume.promise;
              }
            }
            if (/^\s*(COMMIT|ROLLBACK)\b/i.test(text)) {
              client.active = false;
              if (hold) { hold.held = false; hold.done.resolve(); }
            }
            return result;
          },
          release() {
            assert.equal(client.active, false, 'commit or roll back before release');
            assert.equal(client.released, false, 'release the client exactly once');
            client.released = true;
          },
        };
      },
    } as unknown as Pool;

    for (const expectedStatus of ['new', 'auto_processing']) {
      const id = await reset(expectedStatus);
      assert.equal((await changeStatus(request({ discoveryItemId: id, action: 'reopen', expectedStatus }))).status, 200,
        'a matching import handoff remains supported');
      assert.equal((await snapshot(id)).item.status, 'curator_pending');
      assert.equal((await changeStatus(request({ discoveryItemId: id, action: 'rejected', reason: 'Newer curator decision' }))).status, 200);
      const before = await snapshot(id);
      assert.equal((await changeStatus(request({ discoveryItemId: id, action: 'reopen', expectedStatus }))).status, 409);
      assert.deepEqual(await snapshot(id), before, 'a stale reopen cannot revive a rejected item or erase its reason/draft');
      assert.equal((await approve(request(draft(id)))).status, 409, 'a stale publish reads the current rejection');
      assert.deepEqual(await snapshot(id), before, 'rejected publication writes nothing');
    }

    for (const failure of ['source', 'status'] as const) {
      const id = await reset();
      const before = await snapshot(id);
      failWrite = failure;
      assert.equal((await approve(request(draft(id)))).status, 500);
      failWrite = null;
      assert.deepEqual(await snapshot(id), before, `${failure} write failure rolls back the event, source link and queue state together`);
      assert.equal((await approve(request(draft(id)))).status, 200, 'the rolled-back item remains safely publishable');
      const saved = await snapshot(id);
      assert.equal(saved.events.length, 1);
      assert.equal(saved.sources.length, 1);
      assert.equal(saved.item.status, 'curator_approved');
      assert.equal(saved.item.event_id, saved.events[0].id);
      assert.equal(saved.sources[0].event_id, saved.events[0].id);
      assert.equal(saved.sources[0].discovery_item_id, id);
      const committed = await snapshot(id);
      assert.equal((await approve(request(draft(id)))).status, 409, 'a repeated approval cannot create a second event');
      assert.deepEqual(await snapshot(id), committed);
    }
    assert.equal(failedWrites, 2, 'both rollback failures were actually exercised');

    const duplicateId = Number((await sql(`INSERT INTO discovery_items(url,source_domain,status,origin)
      VALUES('https://luma.com/duplicate-fixture','luma.com','curator_pending','search') RETURNING id`)).rows[0].id);
    const beforeDuplicate = await snapshot(duplicateId);
    failWrite = 'status';
    assert.equal((await approve(request(draft(duplicateId)))).status, 500);
    failWrite = null;
    assert.equal(failedWrites, 3);
    assert.deepEqual(await snapshot(duplicateId), beforeDuplicate, 'a failed duplicate status write also rolls back the newly added source link');
    const duplicateResponse = await approve(request(draft(duplicateId)));
    assert.equal(duplicateResponse.status, 200);
    assert.equal((await duplicateResponse.json()).status, 'duplicate');
    const duplicate = await snapshot(duplicateId);
    assert.equal(duplicate.events.length, 1);
    assert.equal(duplicate.sources.length, 2);
    assert.equal(duplicate.item.status, 'duplicate');
    assert.equal(duplicate.item.event_id, duplicate.events[0].id);

    const id = await reset();
    hold = { locked: deferred(), resume: deferred(), waiting: deferred(), done: deferred(), held: false };
    const publication = approve(request(draft(id)));
    await Promise.race([hold.locked.promise, publication.then(() => { throw new Error('Publication did not hold the row lock'); })]);
    let settled = false;
    const competing = changeStatus(request({ discoveryItemId: id, action: 'rejected' }))
      .then(response => { settled = true; return response; });
    await Promise.race([hold.waiting.promise, competing.then(() => { throw new Error('Competing status update did not wait'); })]);
    assert.equal(settled, false, 'a competing status write waits behind the publication row lock');
    assert.equal((await snapshot(id)).item.status, 'curator_pending');
    hold.resume.resolve();
    assert.equal((await publication).status, 200);
    assert.equal((await competing).status, 404, 'the guarded update cannot change the row after publication commits');
    hold = undefined;
    const published = await snapshot(id);
    assert.equal(published.item.status, 'curator_approved');
    assert.equal(published.events.length, 1);
    assert.equal(published.sources.length, 1);

    // Also exercise event_id IS NULL independently of the two status exclusions.
    await sql("UPDATE discovery_items SET status='auto_extracted' WHERE id=$1", [id]);
    const linked = await snapshot(id);
    for (const action of ['irrelevant', 'expired', 'needs_date_review', 'rejected', 'reopen']) {
      assert.equal((await changeStatus(request({ discoveryItemId: id, action }))).status, 404);
      assert.deepEqual(await snapshot(id), linked, `${action} cannot orphan a linked published event`);
    }
    assert.ok(clients.length > 0 && clients.every(client => client.released && !client.active));
    console.log('PASS curator publication: stale reopen/publish conflicts, atomic rollback/retry, one event/source/item commit, repeat approval, competing status-write serialization and linked-event guards (actual handlers; in-memory SQL; row-lock scheduling mocked; no live DB/network).');
  } finally {
    hold?.resume.resolve();
    hold?.done.resolve();
    globalThis.__pgPool = previousPool;
    globalThis.fetch = previousFetch;
    if (previousPassword === undefined) delete process.env.CURATOR_PASSWORD;
    else process.env.CURATOR_PASSWORD = previousPassword;
    await db.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
