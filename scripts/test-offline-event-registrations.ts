import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { recordOfflineEventRegistrations, type OfflineBatch } from '../lib/offlineEventRegistrations';
import { hostedRegistrationReport } from '../lib/hostedEventReporting';
import { hostEventGuests, hostEventMoney } from '../lib/eventHostOperations';
import { getHostedEventInfo } from '../lib/hostedEventData';
import { createEventRegistration, getEventTicket, myEventRegistrations } from '../lib/eventRegistrations';
import { filterGuests, guestsCsv } from '../lib/client/eventHostApi';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { RegistrationReportDetails } from '../components/curator/HostedRegistrations';

async function main() {
  const db = new PGlite();
  const oldPool = globalThis.__pgPool, oldFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; throw new Error('No external calls allowed'); };
  const query = async (sql: string, params?: unknown[]) => { const r = await db.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; };
  globalThis.__pgPool = { query, connect: async () => ({ query, release() {} }) } as unknown as NonNullable<typeof globalThis.__pgPool>;
  const batch: OfflineBatch = { eventId: 164, expectedTitle: 'Offline test event', expectedTotalPaise: 59800,
    guests: [{ name: 'Offline Reader A', phone: '+91 98000 01111', amountPaise: 29900, reference: 'fixture-offline-a' },
      { name: 'Offline Reader B', amountPaise: 29900, reference: 'fixture-offline-b' }] };
  try {
    await db.exec(readFileSync('db/schema.sql', 'utf8'));
    await db.exec(readFileSync('db/migrations/2026-11-12-hosted-events.sql', 'utf8'));
    await db.exec(readFileSync('db/migrations/2026-11-21-offline-event-registrations.sql', 'utf8'));
    await db.exec(readFileSync('db/migrations/2026-11-21-offline-event-registrations.sql', 'utf8'));
    await db.exec(`INSERT INTO events(id,title,category,status,start_at,end_at,primary_source_url,source_type)
      VALUES(164,'Offline test event','arts','live',now()+interval '10 days',now()+interval '10 days 2 hours','https://scene044.in/fixture','curator');
      INSERT INTO hosted_events(event_id,host_name,price_paise,capacity,registration_state,refund_policy) VALUES(164,'Fixture host',29900,15,'open','Fixture');
      INSERT INTO venue_users(phone_e164,name,email) SELECT '91999999000'||n,'Online Reader '||n,'fixture'||n||'@example.com' FROM generate_series(1,7) n;
      INSERT INTO event_registrations(event_id,user_id,name,email,phone_e164,registration_token,ticket_token,code,amount_paise,status,order_id,payment_id,fee_paise,paid_at)
      SELECT 164,id,name,email,phone_e164,'fixture-reg-'||id,lpad(id::text,64,'0'),'SCN-EVT-ONLINE'||id,29900,'confirmed','order_fixture'||id,'pay_fixture'||id,706,now() FROM venue_users;`);
    const before = (await db.query('SELECT * FROM event_registrations ORDER BY id')).rows;
    const preview = await recordOfflineEventRegistrations(batch);
    assert.equal(preview.applied, false); assert.equal(preview.addedCount, 2); assert.equal(preview.addedPaise, 59800);
    assert.deepEqual((await db.query('SELECT * FROM event_registrations ORDER BY id')).rows, before, 'dry run never writes');
    const first = await recordOfflineEventRegistrations(batch, true);
    assert.equal(first.beforeCount, 7); assert.equal(first.registeredCount, 9); assert.equal(first.remainingSeats, 6); assert.equal(first.grossPaise, 269100);
    const repeated = await recordOfflineEventRegistrations(batch, true);
    assert.equal(repeated.addedCount, 0); assert.equal(repeated.existingCount, 2); assert.equal(repeated.grossPaise, 269100);
    const offline = (await db.query<Record<string, unknown>>("SELECT * FROM event_registrations WHERE payment_source='host_direct' ORDER BY name")).rows;
    assert.equal(offline.length, 2); assert.equal(offline[0].phone_e164, '919800001111'); assert.equal(offline[1].phone_e164, null);
    for (const row of offline) {
      assert.equal(row.user_id, null); assert.equal(row.email, null); assert.equal(row.order_id, null); assert.equal(row.payment_id, null);
      assert.equal(row.whatsapp_opt_in, false); assert.equal(row.fee_paise, 0); assert.equal(row.checked_in_at, null); assert.equal(row.status, 'confirmed');
    }
    assert.deepEqual((await db.query('SELECT * FROM event_registrations WHERE user_id IS NOT NULL ORDER BY id')).rows, before, 'original online payments stay byte-for-byte unchanged');
    const report = await hostedRegistrationReport(164, 'paid', '', 1);
    assert.equal(report.summary.registeredCount, 9); assert.equal(report.summary.grossPaise, 269100);
    assert.equal(report.summary.hostCollectedPaise, 59800); assert.equal(report.summary.sceneCollectedPaise, 209300); assert.equal(report.summary.checkedInCount, 0);
    const ui = load(renderToStaticMarkup(createElement(RegistrationReportDetails, { report })));
    assert.match(ui.text(), /Offline · paid directly to host/); assert.match(ui.text(), /Not provided/);
    assert.doesNotMatch(ui.text(), /\+null|\+undefined|NaN/);
    const money = await hostEventMoney(164);
    assert.equal(money.grossPaise, 269100); assert.equal(money.hostCollectedPaise, 59800); assert.equal(money.sceneCollectedPaise, 209300);
    assert.equal(money.feesPaise, 4942); assert.equal(money.sceneNetPaise, 204358); assert.equal(money.paymentsCount, 9);
    assert.equal(money.payments.filter(p => p.status === 'paid_offline' && p.paymentId === null).length, 2);
    assert.equal((await getHostedEventInfo(164))?.registeredCount, 9);
    const guests = await hostEventGuests(164);
    assert.equal(guests.length, 9); assert.equal(guests.find(g => g.name === 'Offline Reader B')?.phone, '');
    assert.equal(filterGuests(guests, 'reader b', 'not_arrived').length, 1); assert.doesNotThrow(() => guestsCsv(guests));
    const ticket = await getEventTicket(164, offline[1].ticket_token as string);
    assert.equal(ticket?.phoneMasked, 'Not provided');
    const owner = (await db.query<{ id: number }>("INSERT INTO venue_users(phone_e164,name,email) VALUES('919800001111','Offline Reader A','verified@example.com') RETURNING id")).rows[0];
    assert.equal((await myEventRegistrations(owner.id)).length, 1, 'verified phone can retrieve its offline ticket');
    await assert.rejects(createEventRegistration(164, { id: owner.id, phoneE164: '919800001111', name: 'Offline Reader A', email: 'verified@example.com', role: 'Organiser', venue: null }, { name: 'Offline Reader A', email: 'verified@example.com' }), /already registered/);
    assert.equal((await db.query('SELECT id FROM event_notifications')).rows.length, 0);
    await assert.rejects(recordOfflineEventRegistrations({ ...batch, expectedTotalPaise: 100 }, true), /batch total/);
    await assert.rejects(recordOfflineEventRegistrations({ ...batch, expectedTitle: 'Wrong event' }, true), /identity/);
    await assert.rejects(recordOfflineEventRegistrations({ ...batch, guests: [{ ...batch.guests[0], phone: '123' }, batch.guests[1]] }, true), /Invalid/);
    await assert.rejects(recordOfflineEventRegistrations({ ...batch, guests: [{ ...batch.guests[0], name: 'Changed guest' }, batch.guests[1]] }, true), /different details/);
    await assert.rejects(recordOfflineEventRegistrations({ ...batch, guests: [{ ...batch.guests[0], reference: 'new-reference' }, batch.guests[1]] }, true), /already be registered/);
    await assert.rejects(recordOfflineEventRegistrations({ ...batch, guests: [{ ...batch.guests[0], reference: 'new-person', name: 'New reader', phone: null }, { ...batch.guests[1], reference: 'old-person', name: 'Online Reader 1' }] }, true), /already be registered/);
    assert.equal((await getHostedEventInfo(164))?.registeredCount, 9, 'rejected batches are atomic');
    await db.exec('UPDATE hosted_events SET capacity=9 WHERE event_id=164');
    await assert.rejects(recordOfflineEventRegistrations({ ...batch, guests: batch.guests.map((g,i) => ({ ...g, name: `New reader ${i}`, reference: `new-reader-${i}`, phone: null })) }, true), /exceed capacity/);
    await assert.rejects(db.exec("UPDATE event_registrations SET payment_id='pay_fake' WHERE payment_source='host_direct'"), /event_registration_payment_source/);
    await assert.rejects(db.exec("UPDATE event_registrations SET whatsapp_opt_in=true WHERE payment_source='host_direct'"), /event_registration_payment_source/);
    await assert.rejects(db.exec("UPDATE event_registrations SET fee_paise=NULL WHERE payment_source='host_direct'"), /event_registration_payment_source/);
    assert.equal(providerCalls, 0);
    console.log('PASS offline entries: atomic dry-run/apply, repeat-safe +2 seats/+598, unchanged online records, no invented contacts/accounts/gateway IDs, paid-to-host money split, ticket access, duplicate/capacity guards, no check-ins, messages or provider calls');
  } finally { globalThis.__pgPool = oldPool; globalThis.fetch = oldFetch; await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
