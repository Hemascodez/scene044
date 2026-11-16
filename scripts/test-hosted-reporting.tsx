import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { PGlite } from '@electric-sql/pglite';
import { GET } from '../app/api/admin/hosted-events/[id]/registrations/route';
import { RegistrationReportDetails } from '../components/curator/HostedRegistrations';
import type { HostedRegistrationReport } from '../lib/hostedEventReporting';

async function main() {
  const db = new PGlite();
  const oldPool = globalThis.__pgPool;
  const oldPassword = process.env.CURATOR_PASSWORD;
  const oldFetch = globalThis.fetch;
  process.env.CURATOR_PASSWORD = 'isolated-reporting';
  globalThis.fetch = async () => { throw new Error('Reporting must never call payment or messaging providers'); };
  let reads = 0;
  globalThis.__pgPool = { query: async (sql: string, params?: unknown[]) => {
    assert.match(sql, /^\s*SELECT\b/i, 'reporting only reads'); reads++;
    const r = await db.query(sql, params); return { rows: r.rows, rowCount: r.rows.length };
  } } as unknown as NonNullable<typeof globalThis.__pgPool>;
  const req = (suffix = '', admin = true) => new Request(`https://scene044.in/api/admin/hosted-events/164/registrations${suffix}`, { headers: admin ? { authorization: `Basic ${Buffer.from('curator:isolated-reporting').toString('base64')}` } : {} });
  const context = (id = '164') => ({ params: Promise.resolve({ id }) });
  const report = async (suffix = '', id = '164') => {
    const response = await GET(req(suffix), context(id)); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return await response.json() as HostedRegistrationReport;
  };
  try {
    await db.exec(`CREATE TABLE events(id integer PRIMARY KEY,title text);
      CREATE TABLE hosted_events(event_id integer PRIMARY KEY,capacity integer);
      CREATE TABLE event_registrations(id serial PRIMARY KEY,event_id integer,name text,email text,phone_e164 text,code text,status text,amount_paise integer,
        created_at timestamptz DEFAULT now(),paid_at timestamptz,checked_in_at timestamptz,hold_until timestamptz,order_id text,ticket_token text DEFAULT 'private-ticket-token',registration_token text DEFAULT 'private-registration-token',payment_id text DEFAULT 'private-payment-id');
      CREATE TABLE event_waitlist(event_id integer,user_id integer);
      INSERT INTO events VALUES(164,'Chapter Lounge - Sunday Reads'),(165,'Other hosted event'),(166,'No registrations yet'),(167,'External event');
      INSERT INTO hosted_events VALUES(164,15),(165,100),(166,20);
      INSERT INTO event_waitlist VALUES(164,1),(164,2);`);
    const cases = [
      ['Paid reader', 'confirmed', true, true], ['Arrived reader', 'checked_in', true, true],
      ['Review reader', 'payment_review', true, true], ['Cancelled reader', 'cancelled', true, true],
      ['Underscore_Name', 'pending', false, true], ['Expired reader', 'pending', false, false],
      ['Inconsistent unpaid row', 'confirmed', false, true],
    ] as const;
    for (const [name, status, paid, active] of cases) await db.query(`INSERT INTO event_registrations(event_id,name,email,phone_e164,code,status,amount_paise,paid_at,checked_in_at,hold_until,order_id)
      VALUES(164,$1,'fixture@example.com','919999999999',$2,$3,29900,CASE WHEN $4 THEN now() END,CASE WHEN $3='checked_in' THEN now() END,now()+CASE WHEN $5 THEN interval '15 minutes' ELSE interval '-15 minutes' END,'order_fixture')`, [name, `SCN-EVT-FIXTURE${name}`, status, paid, active]);
    await db.exec(`INSERT INTO event_registrations(event_id,name,email,phone_e164,code,status,amount_paise,paid_at,hold_until,order_id)
      SELECT 165,'Other event reader '||n,'other@example.com','918888888888','OTHER-'||n,'confirmed',10000,now(),now(),'other-'||n FROM generate_series(1,55) n;`);
    const before = (await db.query('SELECT * FROM event_registrations ORDER BY id')).rows;
    assert.equal((await GET(req('', false), context())).status, 401);
    assert.equal(reads, 0, 'unauthenticated users never reach attendee queries');
    assert.equal((await GET(req(), context('bad'))).status, 400);
    assert.equal((await GET(req('?filter=unknown'), context())).status, 400);
    assert.equal((await GET(req('?page=-1'), context())).status, 400);
    assert.equal((await GET(req(), context('167'))).status, 404);
    const all = await report();
    assert.equal(all.total, 7);
    assert.deepEqual(all.summary, { registeredCount: 2, checkedInCount: 1, checkoutCount: 7, activeUnpaidCount: 1, expiredUnpaidCount: 1, reviewCount: 1, cancelledCount: 1, grossPaise: 59800, waitlistCount: 2 });
    assert.ok(all.registrations.every(r => r.phone === '919999999999'));
    const json = JSON.stringify(all);
    assert.doesNotMatch(json, /private-ticket|private-registration|private-payment|ticketToken|registrationToken|payment_id|ticket_token/);
    assert.equal((await report('?filter=paid')).total, 2);
    assert.equal((await report('?filter=unpaid')).total, 2);
    assert.equal((await report('?filter=checked_in')).total, 1);
    assert.equal((await report('?filter=payment_review')).total, 1);
    assert.equal((await report('?filter=cancelled')).total, 1);
    assert.equal((await report('?q='+encodeURIComponent('_'))).total, 1, 'search treats wildcard characters literally');
    assert.equal((await report('?q='+encodeURIComponent("' OR 1=1 --"))).total, 0, 'search is parameterized');
    const other = await report('?page=2', '165');
    assert.equal(other.total, 55); assert.equal(other.registrations.length, 5); assert.equal(other.summary.registeredCount, 55);
    assert.equal((await report('', '166')).summary.registeredCount, 0);
    assert.equal((await report('', '166')).registrations.length, 0);
    const $ = load(renderToStaticMarkup(createElement(RegistrationReportDetails, { report: all })));
    assert.equal($('article').length, 7); assert.match($('dl').first().text(), /Paid registrations2 \/ 15/);
    assert.match($.text(), /7 checkout records/); assert.doesNotMatch($.text(), /people reached checkout/);
    assert.match($.text(), /not confirmed abandonment/); assert.match($.text(), /fixture@example.com/);
    assert.equal($('a[href^="mailto:"],a[href^="tel:"]').length, 0, 'contact details are plain copyable text, not auto-tracked outbound links');
    assert.deepEqual((await db.query('SELECT * FROM event_registrations ORDER BY id')).rows, before, 'viewing reports never changes registrations or check-in status');
    console.log('PASS curator-only reporting, no-store, all status counts, real-paid-only revenue, host/event isolation, pagination, literal search, token minimization, responsive attendee cards and read-only operation; no provider calls');
  } finally {
    globalThis.__pgPool = oldPool; globalThis.fetch = oldFetch;
    if (oldPassword === undefined) delete process.env.CURATOR_PASSWORD; else process.env.CURATOR_PASSWORD = oldPassword;
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
