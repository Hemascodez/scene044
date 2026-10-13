import assert from 'node:assert/strict';
import { trackBookingRequest, trackBookingCheckout, trackBookingPurchase } from '../lib/client/bookingAnalytics';

const originalWindow = globalThis.window;
const events: { name: string; params: Record<string, unknown> }[] = [];
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  gtag(action: string, name: string, params: Record<string, unknown>) {
    assert.equal(action, 'event'); events.push({ name, params });
  },
  localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) },
} });
try {
  const item = { venueSlug: 'fixture-cafe', spaceId: 'whole-space', value: 7700 };
  trackBookingRequest(item);
  trackBookingCheckout(item);
  const purchase = { ...item, code: 'SCN-FIXTURE', name: 'private-name', phone: 'private-phone', checkinToken: 'private-token' };
  trackBookingPurchase(purchase);
  trackBookingPurchase(purchase);
  assert.deepEqual(events.map(e => e.name), ['generate_lead', 'begin_checkout', 'purchase']);
  assert.equal(events[2].params.transaction_id, 'SCN-FIXTURE');
  assert.equal(events[2].params.value, 7700);
  assert.equal(JSON.stringify(events).includes('private-'), false, 'only allowlisted fields reach GA4');
  trackBookingPurchase({ ...item, code: 'private-token' });
  trackBookingRequest({ ...item, value: NaN });
  assert.equal(events.length, 3);
  Object.assign(window, { gtag: undefined });
  trackBookingPurchase({ ...item, code: 'SCN-BLOCKED' });
  assert.equal(storage.has('scene044:analytics:purchase:SCN-BLOCKED'), false);
  Object.assign(window, { gtag: () => { throw new Error('Analytics blocked'); } });
  assert.doesNotThrow(() => trackBookingCheckout(item));
  console.log('PASS booking funnel, payment deduplication, blocked analytics and personal-data allowlist');
} finally {
  if (originalWindow) Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  else Reflect.deleteProperty(globalThis, 'window');
}
