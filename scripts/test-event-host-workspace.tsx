import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { EventEditionPicker } from '../components/venues/figma/EventEditionPicker';
import { createHostWorkspace, orderedHostEvents } from '../lib/client/eventHostWorkspace';
import { EventHostError, type EventHostApi, type HostEvent, type HostGuest, type MoneySummary } from '../lib/client/eventHostApi';

const now = Date.parse('2026-11-25T10:00:00Z');
const november: HostEvent = { id: 164, title: 'Chapter Lounge - Sunday Reads', slug: 'reading-164', posterImageUrl: null,
  startAt: '2026-11-22T05:30:00Z', endAt: '2026-11-22T07:30:00Z', venueName: 'Preview venue', capacity: 15,
  registeredCount: 11, checkedInCount: 0, pricePaise: 29900 };
const december: HostEvent = { ...november, id: 238, slug: 'reading-238', startAt: '2026-12-06T05:30:00Z', endAt: '2026-12-06T07:30:00Z', registeredCount: 2 };
const guests = (id: number): HostGuest[] => Array.from({ length: id === 164 ? 11 : 2 }, (_, i) => ({
  code: `${id}-${i}`, name: `Sample guest ${i}`, ticketToken: 'sample-token', phone: '', email: '', status: 'confirmed',
  registeredAt: '2026-11-25T09:00:00Z', checkedInAt: null,
}));
const money = (id: number): MoneySummary => ({ grossPaise: guests(id).length * 29900, feesPaise: 0, netPaise: 0, paymentsCount: guests(id).length, settlement: 'Sample', payments: [] });
const reminders = { templates: [], history: [] };
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function api(overrides: Partial<EventHostApi> = {}): EventHostApi {
  return { listEvents: async () => [november, december], guests: async id => guests(id), money: async id => money(id),
    reminders: async () => reminders, checkIn: async () => { throw new Error('Never mutate in this test'); },
    sendReminder: async () => { throw new Error('Never send in this test'); }, ...overrides };
}

async function main() {
  assert.deepEqual(orderedHostEvents([november, december], now).map(e => e.id), [238, 164]);
  const january = { ...december, id: 300, startAt: '2027-01-03T05:30:00Z', endAt: '2027-01-03T07:30:00Z' };
  assert.deepEqual(orderedHostEvents([january, november, december], now).map(e => e.id), [238, 300, 164], 'next event, not farthest future event, opens first');
  assert.equal(orderedHostEvents([november, december], Date.parse('2026-12-06T06:00:00Z'))[0].id, 238, 'keep ongoing event first');
  assert.equal(orderedHostEvents([november, december], Date.parse('2027-02-01'))[0].id, 238, 'when all ended, latest past edition first');

  const store = createHostWorkspace(api(), () => now);
  await store.refresh(); await tick();
  assert.equal(store.getSnapshot().event?.id, 238);
  assert.equal(store.getSnapshot().guests.length, 2);
  assert.equal(store.getSnapshot().money?.grossPaise, 59800);
  store.selectEvent(164);
  assert.equal(store.getSnapshot().event?.id, 164);
  assert.deepEqual(store.getSnapshot().guests, [], 'old details disappear immediately on edition change');
  assert.equal(store.getSnapshot().money, null);
  assert.equal(store.getSnapshot().reminders, null);
  assert.equal(store.getSnapshot().load, 'loading');
  await tick(); await store.refresh(); await tick();
  assert.equal(store.getSnapshot().event?.id, 164, 'polling preserves deliberate historical selection');
  assert.equal(store.getSnapshot().guests.length, 11);
  assert.equal(store.getSnapshot().money?.grossPaise, 328900);

  let approved = [november];
  const newApproval = createHostWorkspace(api({ listEvents: async () => approved }), () => now);
  await newApproval.refresh();
  assert.equal(newApproval.getSnapshot().event?.id, 164);
  approved = [november, december];
  await newApproval.refresh(); await tick();
  assert.equal(newApproval.getSnapshot().event?.id, 238, 'an open old dashboard discovers a newly approved upcoming edition');
  assert.equal(newApproval.getSnapshot().guests.length, 2);

  const oldGuests = deferred<HostGuest[]>();
  let blockOldGuests = true;
  const slow = createHostWorkspace(api({ guests: id => id === 164 && blockOldGuests ? oldGuests.promise : Promise.resolve(guests(id)) }), () => now);
  await slow.refresh();
  slow.selectEvent(164); await tick();
  slow.selectEvent(238); await tick();
  oldGuests.resolve(guests(164)); blockOldGuests = false; await tick();
  assert.equal(slow.getSnapshot().event?.id, 238);
  assert.equal(slow.getSnapshot().guests.length, 2, 'late old guest/reminder response cannot overwrite current event');

  const oldMoney = deferred<MoneySummary>();
  const slowMoney = createHostWorkspace(api({ money: id => id === 164 ? oldMoney.promise : Promise.resolve(money(id)) }), () => now);
  await slowMoney.refresh(); slowMoney.selectEvent(164); await tick();
  slowMoney.selectEvent(238); await tick(); oldMoney.resolve(money(164)); await tick();
  assert.equal(slowMoney.getSnapshot().money?.grossPaise, 59800, 'late November earnings cannot appear under December');

  let failure: Error | null = null;
  const retries = createHostWorkspace(api({ listEvents: async () => { if (failure) throw failure; return [november, december]; } }), () => now);
  await retries.refresh(); await tick(); failure = new Error('Offline'); await retries.refresh();
  assert.equal(retries.getSnapshot().load, 'ready');
  assert.equal(retries.getSnapshot().guests.length, 2, 'transient poll error retains the same event list for the door');
  retries.selectEvent(164); await tick();
  assert.equal(retries.getSnapshot().load, 'error');
  assert.equal(retries.getSnapshot().guests.length, 0, 'failed edition change never reuses previous guests');
  assert.equal(retries.getSnapshot().money, null);
  failure = null; await retries.refresh(); failure = new EventHostError('Access revoked', 403); await retries.refresh();
  assert.equal(retries.getSnapshot().load, 'not_approved');
  assert.deepEqual(retries.getSnapshot().events, []);
  assert.deepEqual(retries.getSnapshot().guests, [], 'revoked session clears private data rather than retaining a stale list');

  const lateList = deferred<HostEvent[]>(); let delayed = false;
  const unmount = createHostWorkspace(api({ listEvents: () => delayed ? lateList.promise : Promise.resolve([november]) }), () => now);
  await unmount.refresh(); delayed = true; const pending = unmount.refresh();
  unmount.invalidate(); lateList.resolve([december]); await pending;
  assert.equal(unmount.getSnapshot().event?.id, 164, 'responses after cleanup cannot update the workspace');

  const $ = load(renderToStaticMarkup(<EventEditionPicker events={[december, november]} event={december} disabled={false} onSelect={() => {}} now={now} />));
  assert.equal($('label[for="event-switcher"]').text(), 'Event edition');
  assert.equal($('option[selected]').attr('value'), '238');
  assert.match($('option[value="238"]').text(), /6 Dec 2026/);
  assert.match($('option[value="164"]').text(), /22 Nov 2026/);
  assert.equal($('optgroup[label="Past events"] option').attr('value'), '164');
  assert.match($('#event-switcher').attr('class')!, /min-h-11.*w-full.*min-w-0.*max-w-full/);
  assert.match($('#event-edition-help').text(), /separate for each date/);
  console.log('PASS upcoming default, explicit past selection, atomic edition reset, stale guest/reminder/money guards, revocation, cleanup and visible date-labelled picker; no real messages/payments');
}
void main();
