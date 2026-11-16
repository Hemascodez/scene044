import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trackHostedStage, trackHostedPurchase } from '../lib/client/hostedEventAnalytics';

async function main() {
  const oldWindow = globalThis.window;
  const calls: { name: string; params: Record<string, unknown> }[] = [];
  const storage = new Map<string, string>();
  const location = { hostname: 'scene044.in', origin: 'https://scene044.in', pathname: '/events/chapter-lounge-sunday-reads-164', search: '?utm_source=test&private=redacted' };
  const stub = { location, gtag: (action: string, name: string, params: Record<string, unknown>) => { assert.equal(action, 'event'); calls.push({ name, params }); }, localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: stub });
  try {
    const item = { eventId: 164, amountPaise: 29900, name: 'private-name', email: 'private-email', phone: 'private-phone', ticketToken: 'private-ticket' };
    for (const stage of ['view_item', 'scene_registration_open', 'scene_otp_sent', 'scene_otp_verified', 'scene_details_completed', 'begin_checkout', 'scene_checkout_dismissed', 'scene_payment_failed'] as const) assert.equal(trackHostedStage(stage, item), true);
    await trackHostedPurchase(item, 'pay_isolatedSecret'); await trackHostedPurchase(item, 'pay_isolatedSecret');
    assert.equal(calls.filter(c => c.name === 'purchase').length, 1);
    assert.equal(calls.at(-1)?.params.value, 299);
    assert.match(String(calls.at(-1)?.params.transaction_id), /^evt-164-[a-f0-9]{32}$/);
    assert.doesNotMatch(JSON.stringify(calls), /private-|pay_isolatedSecret|utm_source|redacted/);
    assert.deepEqual(calls[0].params.items, [{ item_id: 'scene-event-164', item_category: 'Hosted event', quantity: 1, price: 299 }]);
    const count = calls.length;
    for (const [pathname, search, hostname] of [['/events/example-164/ticket', '', 'scene044.in'], ['/events/example-164', '?ticket=secret', 'scene044.in'], ['/admin/curator/hosting', '', 'scene044.in'], ['/dev/hosted-event', '', 'localhost'], ['/events/example-164', '', 'localhost']]) {
      Object.assign(location, { pathname, search, hostname }); assert.equal(trackHostedStage('view_item', item), false);
    }
    assert.equal(calls.length, count);
    Object.assign(location, { pathname: '/events/example-164', search: '', hostname: 'scene044.in' });
    stub.gtag = () => { throw new Error('blocked'); };
    assert.doesNotThrow(() => trackHostedStage('begin_checkout', item));
    await assert.doesNotReject(trackHostedPurchase(item, 'pay_newIsolated'));
    const source = readFileSync('components/scene/hosted/HostedRegistration.tsx', 'utf8');
    assert.ok(source.indexOf('await api.verify(') < source.indexOf('await trackHostedPurchase('), 'purchase is emitted only after server verification');
    assert.match(source, /registration\.amount/); assert.match(source, /apiKind === 'http'/);
    console.log('PASS hosted funnel stages, server-verified purchase ordering, real checkout amount, transaction deduplication, hashed payment IDs, no personal data or ticket URLs, blocked-analytics safety and inert local/private pages; no real GA events');
  } finally { if (oldWindow) Object.defineProperty(globalThis, 'window', { configurable: true, value: oldWindow }); else Reflect.deleteProperty(globalThis, 'window'); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
