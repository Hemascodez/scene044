import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Pool } from 'pg';
import { createVenueBooking, setBookingStatus, withdrawRequestedBooking } from '../lib/venueBookings';
import { recordPaymentOrder, confirmCapturedPayment } from '../lib/venueOperations';
import { createPartnerRequest } from '../lib/venueCatalog';
import { drainVenueNotifications, queueVenueOverrunNotices, recordVenueNotificationReceipt, venueNotificationTemplate,
  type VenueNotification } from '../lib/venueNotifications';
import type { WhatsappTemplateInput } from '../lib/whatsappSend';

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
  const previousPool = globalThis.__pgPool;
  const previousFetch = globalThis.fetch;
  const keys = ['WHATSAPP_VENUE_NOTIFICATIONS_ENABLED','WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_GRAPH_API_VERSION'] as const;
  const previousEnv = keys.map(key => process.env[key]);
  process.env.WHATSAPP_VENUE_NOTIFICATIONS_ENABLED = 'false';
  process.env.WHATSAPP_ACCESS_TOKEN = 'fixture-only';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'fixture-only';
  process.env.WHATSAPP_GRAPH_API_VERSION = 'v24.0';
  const sql = async (text: string, params?: unknown[]) => {
    const result = await db.query(text, params);
    return { ...result, rowCount: /^\s*SELECT\b/i.test(text) ? result.rows.length : result.affectedRows };
  };
  globalThis.__pgPool = { query: sql, connect: async () => ({ query: sql, release() {} }) } as unknown as Pool;
  globalThis.fetch = async () => { throw new Error('All real network sends blocked in isolated test'); };
  const sent: WhatsappTemplateInput[] = [];
  const sender = async (input: WhatsappTemplateInput) => { sent.push(input); return { ok: true as const, providerMessageId: `wamid.fixture-${sent.length}` }; };
  const booking = () => createVenueBooking({ venueSlug: 'time-cafe', venueName: 'Time Cafe', spaceId: 'first-floor', spaceName: 'First floor',
    eventDate: '2026-10-20', startTime: '18:30', durationHours: 3, people: 25, eventType: 'Workshop', description: 'Isolated fixture',
    organizerName: 'Hema', organizerEmail: 'fixture@example.invalid', organizerPhone: '9876543210', whatsappOptIn: true, hourlyRate: 2000, total: 6000 });
  try {
    const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS venue_users')));
    const historical = await booking();
    const migration = readFileSync(new URL('../db/migrations/2026-10-08-venue-notifications.sql', import.meta.url), 'utf8');
    await db.exec(migration); await db.exec(migration);
    assert.equal((await sql('SELECT count(*)::int AS n FROM venue_notifications')).rows[0].n, 0, 'migration never backfills historical bookings');
    await sql("INSERT INTO venue_host_access(venue_slug,phone_e164) VALUES('time-cafe','919111111111'),('time-cafe','919222222222')");
    const b = await booking();
    let rows = (await sql('SELECT * FROM venue_notifications ORDER BY id')).rows as unknown as VenueNotification[];
    assert.equal(rows.length, 3);
    const organiserRequest = rows.find(r => r.audience === 'organiser')!;
    const mapped = venueNotificationTemplate(organiserRequest)!;
    assert.equal(mapped.language, 'en');
    assert.equal(mapped.name, 'scene044_booking_requested_v2');
    assert.deepEqual(mapped.bodyParameters, ['Hema','Workshop','Time Cafe','20 October 2026 at 6:30 pm IST','25',b.code]);
    await drainVenueNotifications(sender); assert.equal(sent.length, 0, 'kill switch prevents sends');
    process.env.WHATSAPP_VENUE_NOTIFICATIONS_ENABLED = 'true';
    await sql("UPDATE venue_host_access SET revoked_at=now() WHERE phone_e164='919222222222'");
    assert.equal((await drainVenueNotifications(sender)).accepted, 2, 'revoked host is skipped at dispatch');
    assert.equal(sent.filter(s => s.name === 'scene044_new_booking_request').length, 1);
    await drainVenueNotifications(sender); assert.equal(sent.length, 2, 'polling never re-sends accepted messages');

    assert.ok(await setBookingStatus(b.id, 'approved'));
    assert.equal(await setBookingStatus(b.id, 'approved'), null);
    await drainVenueNotifications(sender);
    const approved = sent.find(s => s.name === 'scene044_booking_approved')!;
    assert.deepEqual(approved.bodyParameters, ['Hema','Workshop','20 October 2026 at 6:30 pm IST','6,000',b.code]);
    assert.equal(await recordPaymentOrder(b.id, 'order_fixture', 600000), true);
    assert.equal(await confirmCapturedPayment(b.id, 'order_fixture', 'pay_fixture'), true);
    assert.equal(await confirmCapturedPayment(b.id, 'order_fixture', 'pay_fixture'), true);
    await drainVenueNotifications(sender);
    const confirmations = sent.filter(s => s.name.includes('booking_confirmed'));
    assert.equal(confirmations.length, 2, 'duplicate payment verification queues one per audience');
    assert.equal(confirmations[0].bodyParameters[2], '6,000');
    assert.equal(confirmations[1].bodyParameters[3], '6,000');
    await recordVenueNotificationReceipt('wamid.fixture-4','delivered');
    await recordVenueNotificationReceipt('wamid.fixture-4','read');
    await recordVenueNotificationReceipt('wamid.fixture-4','delivered');
    assert.equal((await sql("SELECT state FROM venue_notifications WHERE provider_message_id='wamid.fixture-4'")).rows[0].state, 'read');

    const cancelled = await booking(); await withdrawRequestedBooking(cancelled.id);
    await drainVenueNotifications(sender);
    const cancellation = sent.find(s => s.name === 'scene044_booking_cancelled')!;
    assert.deepEqual(cancellation.bodyParameters, ['Hema',cancelled.code,'you','20 October 2026 at 6:30 pm IST',cancelled.code]);
    const hostCancelled = await booking(); await setBookingStatus(hostCancelled.id,'cancelled'); await drainVenueNotifications(sender);
    assert.equal(sent.filter(s=>s.name==='scene044_booking_cancelled').at(-1)!.bodyParameters[2],'the venue');
    const declined = await booking(); await setBookingStatus(declined.id,'declined'); await drainVenueNotifications(sender);
    assert.equal(sent.filter(s=>s.name==='scene044_booking_declined').length,1);
    const expired = await booking(); await setBookingStatus(expired.id,'expired'); await drainVenueNotifications(sender);
    assert.equal(sent.filter(s=>s.name==='scene044_booking_expired').length,1);

    const trial = await booking();
    await sql('UPDATE venue_bookings SET trial_amount_paise=1000,trial_duration_minutes=5 WHERE id=$1',[trial.id]);
    await setBookingStatus(trial.id,'approved'); await drainVenueNotifications(sender);
    assert.equal(sent.filter(s=>s.name==='scene044_booking_approved').at(-1)!.bodyParameters[3],'10');
    await recordPaymentOrder(trial.id,'order_trial',1000); await confirmCapturedPayment(trial.id,'order_trial','pay_trial');
    await drainVenueNotifications(sender);
    await sql("UPDATE venue_bookings SET status='checked_in',ends_at=now()-interval '1 minute' WHERE id=$1",[trial.id]);
    assert.equal(await queueVenueOverrunNotices(),1); assert.equal(await queueVenueOverrunNotices(),0);
    await drainVenueNotifications(sender);
    assert.deepEqual(sent.find(s=>s.name==='scene044_venue_overrun')!.bodyParameters,['Hema','Time Cafe','First floor']);

    const quote = await booking(); await sql('UPDATE venue_bookings SET total=NULL,hourly_rate=NULL WHERE id=$1',[quote.id]);
    await setBookingStatus(quote.id,'approved');
    assert.ok((await drainVenueNotifications(sender)).skipped >= 1, 'no false ₹0 approval for quote-only room');
    const archived = await booking(); await sql('UPDATE venue_bookings SET archived_at=now() WHERE id=$1',[archived.id]);
    assert.equal((await drainVenueNotifications(sender)).accepted,0, 'archive cancels pending messages');
    const noConsent = await booking(); await sql('UPDATE venue_bookings SET whatsapp_opt_in=false WHERE id=$1',[noConsent.id]);
    const beforeOptOut = sent.length; await drainVenueNotifications(sender);
    assert.equal(sent.length-beforeOptOut,1,'host still gets genuine request, organiser opt-out is honoured');

    await sql('BEGIN'); await booking(); await sql('ROLLBACK');
    assert.equal((await sql("SELECT count(*)::int AS n FROM venue_notifications WHERE state='pending'")).rows[0].n,0, 'rollback removes outbox event too');
    await createPartnerRequest({contactName:'Fixture host',phone:'9876543210',venueName:'Fixture venue',area:'Chennai',details:'Test listing'});
    const listingRow = (await sql("SELECT * FROM venue_notifications WHERE kind='listing_received'")).rows[0] as unknown as VenueNotification;
    assert.deepEqual(venueNotificationTemplate(listingRow)!.bodyParameters,['Fixture host','Fixture venue','Chennai']);
    const failure = await drainVenueNotifications(async () => ({ok:false,kind:'retryable',status:429,error:'Fixture rate limit'}));
    assert.equal(failure.retried,1);
    assert.equal((await drainVenueNotifications(sender)).accepted,0,'backoff waits before retrying');
    await sql("UPDATE venue_notifications SET next_attempt_at=now() WHERE state='pending'");
    assert.equal((await drainVenueNotifications(sender)).accepted,1);

    await createPartnerRequest({contactName:'Fixture host',phone:'9876543210',venueName:'Unknown send',area:'Chennai',details:'Test listing'});
    assert.equal((await drainVenueNotifications(async () => ({ok:false,kind:'unknown',error:'Fixture lost response'}))).unknown,1);
    assert.equal((await drainVenueNotifications(sender)).accepted,0,'uncertain sends are not repeated');
    await createPartnerRequest({contactName:'Fixture host',phone:'9876543210',venueName:'Fatal send',area:'Chennai',details:'Test listing'});
    assert.equal((await drainVenueNotifications(async () => ({ok:false,kind:'fatal',error:'Fixture wrong template'}))).failed,1);
    await createPartnerRequest({contactName:'Fixture host',phone:'9876543210',venueName:'Receipt race',area:'Chennai',details:'Test listing'});
    await drainVenueNotifications(async input => {
      await recordVenueNotificationReceipt('wamid.early','delivered',input.opaqueCallbackData);
      return {ok:true,providerMessageId:'wamid.early'};
    });
    assert.equal((await sql("SELECT state FROM venue_notifications WHERE provider_message_id='wamid.early'")).rows[0].state,'delivered','early receipt is not downgraded');
    await sql("UPDATE venue_notifications SET state='sending',claimed_at=now()-interval '6 minutes' WHERE event_key='partner:1'");
    await drainVenueNotifications(sender);
    assert.equal((await sql("SELECT state FROM venue_notifications WHERE event_key='partner:1'")).rows[0].state,'unknown');
    assert.ok(await setBookingStatus(historical.id,'declined')); // Genuine new transition only.
    assert.equal((await sql('SELECT count(*)::int AS n FROM venue_notifications WHERE booking_id=$1',[historical.id])).rows[0].n,1);
    rows = (await sql('SELECT * FROM venue_notifications')).rows as unknown as VenueNotification[];
    assert.equal(new Set(rows.map(r=>venueNotificationTemplate(r)?.name).filter(Boolean)).size,10,'all ten approved templates covered');
    assert.ok(rows.every(r=>!JSON.stringify(r.payload).includes('checkin_token')),'QR secrets never enter message outbox');
    console.log('Venue notifications PASS: ten templates, atomic events, prices, trial, opt-in, host revocation, no backfill, retries, uncertain sends and receipt races. No real messages sent.');
  } finally {
    globalThis.__pgPool=previousPool; globalThis.fetch=previousFetch;
    keys.forEach((key,index)=>{if(previousEnv[index]===undefined) delete process.env[key]; else process.env[key]=previousEnv[index];});
    await db.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
