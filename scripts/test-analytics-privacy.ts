import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { gaInlineScript, gaMeasurementId } from '../lib/client/analytics';
import { trackBookingCheckout, trackBookingPurchase, trackBookingRequest } from '../lib/client/bookingAnalytics';
import { trackHostedPurchase, trackHostedStage } from '../lib/client/hostedEventAnalytics';

// Exercise the exact emitted JavaScript without loading Google's script.
// Stream-side Enhanced Measurement settings must be verified separately.
type Command = [string, string | Date | Record<string, unknown>, Record<string, unknown>?];
type Fields = Record<string, unknown>;
function fixture(href: string, referrer = '', title = 'Fixture public event — SCENE') {
  const listeners = new Map<string, (() => void)[]>();
  const storage = new Map<string, string>();
  const calls: unknown[][] = [];
  const win = {
    location: new URL(href),
    dataLayer: { push: (args: IArguments) => calls.push(Array.from(args)) },
    gtag: undefined as undefined | ((action: string, name: string, params: Fields) => void),
    history: {
      pushState(this: unknown, ...args: unknown[]) {
        assert.equal(this, win.history);
        if (args[0] === 'throw') throw new Error('native history error');
        if (args[2] !== undefined && args[2] !== null) win.location = new URL(String(args[2]), win.location);
        return 'native-result';
      },
      replaceState(this: unknown, ...args: unknown[]) {
        assert.equal(this, win.history);
        if (args[2] !== undefined && args[2] !== null) win.location = new URL(String(args[2]), win.location);
      },
    },
    addEventListener: (name: string, fn: () => void) => listeners.set(name, [...(listeners.get(name) ?? []), fn]),
    localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) },
  };
  let titleReads = 0;
  let currentTitle = title;
  const doc = { referrer, get title() { titleReads++; return currentTitle; }, set title(value: string) { currentTitle = value; } };
  const globals = { window: win, document: doc, URL, Number, Date };
  const start = () => runInNewContext(gaInlineScript('G-PRIVACY'), globals);
  start();
  const events = () => calls.filter(c => c[0] === 'event') as Command[];
  const pageviews = () => events().filter(c => c[1] === 'page_view');
  const pop = (url: string) => { win.location = new URL(url, win.location); listeners.get('popstate')?.forEach(fn => fn()); };
  return { win, doc, calls, events, pageviews, pop, start, titleReads: () => titleReads };
}

async function main() {
  const oldId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  try {
    for (const id of ['', 'invalid', 'G-X</script>', 'G-A\n']) {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = id;
      assert.equal(gaMeasurementId(), id === 'G-A\n' ? 'G-A' : null);
    }
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = ' G-TEST123 ';
    assert.equal(gaMeasurementId(), 'G-TEST123');
    assert.equal(gaInlineScript("G-X'</script>"), '');
  } finally {
    if (oldId === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = oldId;
  }

  for (const url of [
    'https://localhost/events/fixture-164', 'http://scene044.in/bookings', 'https://scene044.in:3000/',
    'https://scene044.vercel.app/', 'https://scene044.in.attacker.test/',
    'https://scene044.in/host', 'https://scene044.in/host/checkin/private-path', 'https://scene044.in/admin/login',
    'https://scene044.in/admin/curator/hosting', 'https://scene044.in/bookings?ref=private-ref',
    'https://scene044.in/account/delete', 'https://scene044.in/dev/hosted-event', 'https://scene044.in/api/host/checkin',
    'https://scene044.in/events/fixture-164/ticket', 'https://scene044.in/events/fixture-164/ticket/private-path',
    'https://scene044.in/events/fixture-164?ticket=private-query', 'https://scene044.in/events/fixture-164?%74icket=private-query',
    'https://scene044.in/events/fixture-164?Ticket=', 'https://scene044.in/events/fixture-164?ticketToken=private-query',
    'https://scene044.in/venues/cafe?email=private-person', 'https://scene044.in/venues/%68ost/private-path',
    'https://scene044.in/events/city/mumbai?ticket=private-query',
    'https://scene044.in/events/city/gurugram/ticket/private-path',
    'https://scene044.in/events/city/9876543210',
  ]) {
    const f = fixture(url);
    assert.equal(f.calls.length, 0, `no GA initialisation on ${url}`);
  }

  const initiallyPrivate = fixture('https://scene044.in/host/checkin/private-path', '', 'Hemalatha bookings');
  assert.equal(initiallyPrivate.win.gtag, undefined);
  initiallyPrivate.win.history.pushState({}, '', '/bookings?ref=private-query');
  assert.equal(typeof initiallyPrivate.win.gtag, 'function', 'checkout can start after private navigation');
  assert.equal(initiallyPrivate.calls.length, 0, 'booking navigation alone does not initialise GA');
  initiallyPrivate.win.history.pushState({}, '', '/events/fixture-164');
  assert.equal(initiallyPrivate.pageviews().length, 1, 'a private landing can later enter the public funnel');
  assert.equal(initiallyPrivate.pageviews()[0][2]?.page_referrer, '');
  assert.equal(initiallyPrivate.pageviews()[0][2]?.page_title, 'Event — SCENE', 'stale private DOM title is never used on the next public page');
  assert.equal(initiallyPrivate.titleReads(), 0, 'a private landing title is never read, including after navigation');
  assert.doesNotMatch(JSON.stringify(initiallyPrivate.calls), /Hemalatha|bookings|private-/);

  for (const path of ['/', '/events/fixture-164', '/events/chennai/this-weekend', '/events/city/mumbai', '/events/city/delhi', '/events/city/gurugram', '/category/arts', '/venues', '/venues/search', '/venues/partner', '/venues/fixture-cafe', '/privacy', '/terms']) {
    const f = fixture(`https://www.scene044.in${path}?utm_source=reader%40example.test&unknown=private-query#private-hash`, 'https://search.test/private-path?email=private-person');
    assert.equal(f.pageviews().length, 1, `one initial view: ${path}`);
    assert.equal(f.pageviews()[0][2]?.page_location, `https://www.scene044.in${path}`);
    assert.equal(f.pageviews()[0][2]?.page_referrer, 'https://search.test');
    assert.equal(f.pageviews()[0][2]?.page_title, 'Fixture public event — SCENE');
    assert.equal(f.calls.filter(c => c[0] === 'config').length, 1);
    assert.equal((f.calls.find(c => c[0] === 'config')?.[2] as Fields).send_page_view, false);
    assert.doesNotMatch(JSON.stringify(f.calls), /private-|utm_source/);
  }

  const cityNavigation = fixture('https://scene044.in/events/city/mumbai');
  cityNavigation.win.history.pushState({}, '', '/events/city/gurugram?utm_source=scene');
  cityNavigation.win.history.replaceState({}, '', '/events/city/gurugram#feed');
  assert.equal(cityNavigation.pageviews().length, 2, 'one view per city, not per query or hash');
  assert.equal(cityNavigation.pageviews()[1][2]?.page_title, 'City events — SCENE');

  const attribution = fixture('https://scene044.in/events/fixture-164?utm_source=newsletter&utm_medium=email&utm_campaign=sunday-reads&utm_id=launch-26&utm_term=venue+booking&utm_content=hero_cta&own_name=private-person&unknown=private-query&gclid=private-click-id&gbraid=private-braid#private-hash', '', 'Sunday Reads — SCENE');
  const campaignFields = {
    campaign_source: 'newsletter', campaign_medium: 'email', campaign_name: 'sunday-reads',
    campaign_id: 'launch-26', campaign_term: 'venue booking', campaign_content: 'hero_cta',
  };
  for (const [key, value] of Object.entries(campaignFields)) assert.equal(attribution.pageviews()[0][2]?.[key], value, key);
  assert.equal(attribution.pageviews()[0][2]?.page_title, 'Sunday Reads — SCENE');
  assert.equal(attribution.pageviews()[0][2]?.page_location, 'https://scene044.in/events/fixture-164');
  assert.doesNotMatch(JSON.stringify(attribution.calls), /private-|own_name|unknown|utm_|gclid|gbraid/);
  for (const value of [
    'reader@example.test', '+91 98765 43210', '9876543210', 'https://example.test', 'example.test',
    'ticket-private-value', 'pay_privateGateway', 'bearer private-value', 'a'.repeat(65), 'a'.repeat(64),
    'aB3dE5gH7jK9mN2pQ4rS6tV8', '550e8400-e29b-41d4-a716-446655440000', 'double%40encoded', 'line\nbreak',
  ]) {
    const invalid = fixture(`https://scene044.in/?utm_campaign=${encodeURIComponent(value)}`);
    assert.equal(invalid.pageviews()[0][2]?.campaign_name, undefined, `unsafe UTM rejected: ${value}`);
    assert.equal((invalid.calls.find(c => c[0] === 'config')?.[2] as Fields).campaign_name, undefined);
  }
  assert.equal(fixture('https://scene044.in/?utm_source=one&utm_source=two').pageviews()[0][2]?.campaign_source, undefined, 'ambiguous repeated UTMs are rejected');
  assert.equal(fixture('https://scene044.in/?campaign_source=private-person').pageviews()[0][2]?.campaign_source, undefined, 'only the six standard UTM keys are read');
  for (const title of ['Contact reader@example.test', 'Call +91 98765 43210', 'https://example.test/private', 'Ticket '+ 'a'.repeat(64)]) {
    assert.equal(fixture('https://scene044.in/', '', title).pageviews()[0][2]?.page_title, 'SCENE', 'obvious personal data and tokens in titles are rejected');
  }

  const f = fixture('https://scene044.in/', 'https://scene044.in/host/checkin/private-path?ticket=private-query');
  assert.equal(f.pageviews()[0][2]?.page_referrer, '');
  f.start();
  assert.equal(f.pageviews().length, 1, 're-running the bootstrap is inert');
  assert.equal(f.win.history.pushState({ __NA: true }, '', '/events/fixture-164?utm_source=newsletter'), 'native-result');
  f.win.history.replaceState({ __NA: true }, '', '/events/fixture-164?unrecognised=private-query#private-hash');
  f.pop('/events/fixture-164#different');
  assert.equal(f.pageviews().length, 2, 'same route/query/hash churn emits no duplicate');
  assert.equal(f.pageviews()[1][2]?.page_referrer, 'https://scene044.in/');
  assert.equal(f.pageviews()[1][2]?.page_title, 'Event — SCENE', 'the previous public document title is not assigned to a different route');
  assert.equal(f.titleReads(), 1, 'only the initial public title is captured');
  for (const path of ['/host/checkin/private-path', '/events/fixture-164?ticket=private-query', '/events/fixture-164/ticket/private-path', '/bookings?ref=private-ref']) f.win.history.pushState({}, '', path);
  assert.equal(f.pageviews().length, 2, 'soft private navigation emits no view');
  f.pop('/venues/fixture-cafe');
  assert.equal(f.pageviews().length, 3);
  assert.equal(f.pageviews()[2][2]?.page_referrer, '', 'private previous URL is never a referrer');
  f.pop('/');
  assert.equal(f.pageviews().length, 4, 'back/forward to another public route is counted once');
  assert.equal(f.pageviews()[3][2]?.page_title, 'Fixture public event — SCENE', 'captured initial title stays bound to its original public URL');
  assert.equal(f.titleReads(), 1, 'back/forward navigation never rereads document.title');
  assert.throws(() => f.win.history.pushState('throw', '', '/terms'), /native history error/);
  assert.equal(f.pageviews().length, 4, 'failed history mutation is not counted');
  assert.doesNotMatch(JSON.stringify(f.calls), /private-/);

  const oldWindow = globalThis.window;
  try {
    const setWindow = (win: ReturnType<typeof fixture>['win']) => Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
    const booking = fixture('https://scene044.in/bookings?ref=private-ref&utm_source=private-source&utm_campaign=private-campaign', 'https://scene044.in/events/fixture-164/ticket?ticket=private-referrer&utm_source=private-referrer-source', 'Hemalatha bookings');
    setWindow(booking.win);
    const venueItem = { venueSlug: 'fixture-cafe', spaceId: 'whole-space', value: 7700 };
    trackBookingCheckout(venueItem);
    trackBookingPurchase({ ...venueItem, code: 'SCN-FIXTURE' });
    trackBookingPurchase({ ...venueItem, code: 'SCN-FIXTURE' });
    assert.deepEqual(booking.events().map(c => c[1]), ['begin_checkout', 'purchase']);
    assert.equal(booking.pageviews().length, 0, 'booking conversions do not create private pageviews');
    assert.equal(booking.events()[1][2]?.transaction_id, 'SCN-FIXTURE');
    assert.equal(booking.events()[1][2]?.page_location, 'https://scene044.in/venues/fixture-cafe');
    assert.equal(booking.events()[1][2]?.page_title, 'SCENE');
    assert.equal(booking.events()[1][2]?.campaign_source, undefined);
    assert.equal(booking.events()[1][2]?.campaign_name, undefined);
    assert.doesNotMatch(JSON.stringify(booking.calls), /private-|ref=|\/bookings/);
    booking.win.history.pushState({}, '', '/venues/fixture-cafe');
    trackBookingRequest(venueItem);
    assert.equal(booking.events().at(-1)?.[1], 'generate_lead');
    assert.equal(booking.events().at(-1)?.[2]?.page_title, 'Venue — SCENE');
    assert.equal(booking.titleReads(), 0, 'booking conversions and subsequent public events never read a private title');
    assert.doesNotMatch(JSON.stringify(booking.calls), /Hemalatha|bookings|private-/);

    setWindow(attribution.win);
    const campaignItem = { eventId: 164, amountPaise: 29900 };
    trackHostedStage('begin_checkout', campaignItem);
    for (const [key, value] of Object.entries(campaignFields)) assert.equal(attribution.events().at(-1)?.[2]?.[key], value, `public funnel keeps ${key}`);
    attribution.doc.title = 'private-person private-token';
    attribution.win.history.pushState({}, '', '/bookings?utm_source=private-source&utm_campaign=private-campaign');
    const privateDefaults = attribution.calls.filter(c => c[0] === 'set').at(-1)?.[1] as Fields;
    assert.equal(privateDefaults.campaign_source, null, 'public campaign overrides are cleared on private navigation');
    assert.equal(privateDefaults.campaign_name, null);
    trackBookingPurchase({ ...venueItem, code: 'SCN-ATTRIBUTION' });
    assert.equal(attribution.events().at(-1)?.[1], 'purchase');
    assert.equal(attribution.events().at(-1)?.[2]?.page_title, 'SCENE');
    assert.equal(attribution.events().at(-1)?.[2]?.campaign_source, undefined);
    assert.equal(attribution.events().at(-1)?.[2]?.page_location, 'https://scene044.in/venues/fixture-cafe');
    attribution.win.history.pushState({}, '', '/venues?utm_source=public-directory');
    assert.equal(attribution.pageviews().at(-1)?.[2]?.page_title, 'Venues — SCENE');
    assert.equal(attribution.pageviews().at(-1)?.[2]?.campaign_source, 'public-directory');
    assert.equal(attribution.pageviews().at(-1)?.[2]?.page_referrer, '');
    assert.equal(attribution.titleReads(), 1, 'public-to-private-to-public navigation never reads the live DOM title');
    assert.doesNotMatch(JSON.stringify(attribution.calls), /private-|\/bookings|utm_|gclid|gbraid/);

    const hosted = fixture('https://scene044.in/events/fixture-164?unknown=private-query');
    setWindow(hosted.win);
    const hostedItem = { eventId: 164, amountPaise: 29900, email: 'private-person', ticketToken: 'private-token' };
    for (const stage of ['view_item', 'scene_registration_open', 'scene_otp_sent', 'scene_otp_verified', 'scene_details_completed', 'begin_checkout', 'scene_checkout_dismissed', 'scene_payment_failed'] as const) trackHostedStage(stage, hostedItem);
    await trackHostedPurchase(hostedItem, 'pay_privateGateway');
    await trackHostedPurchase(hostedItem, 'pay_privateGateway');
    assert.equal(hosted.events().length, 10, 'one pageview, eight funnel stages and one purchase');
    assert.match(String(hosted.events().at(-1)?.[2]?.transaction_id), /^evt-164-[a-f0-9]{32}$/);
    assert.equal(hosted.events().at(-1)?.[2]?.transport_type, 'beacon', 'confirmed hosted purchase retains beacon transport before ticket navigation');
    hosted.win.gtag?.('event', 'purchase', { ...hosted.events().at(-1)?.[2], transaction_id: 'pay_privateGateway' });
    assert.equal(hosted.events().length, 10, 'raw payment IDs are rejected');
    hosted.win.gtag?.('event', 'view_item', { ...hosted.events()[1][2], transport_type: 'private-transport', email: 'private-person', page_location: 'private-location', page_referrer: 'private-referrer', page_title: 'private-title' });
    assert.equal(hosted.events().length, 11);
    assert.equal(hosted.events().at(-1)?.[2]?.transport_type, 'beacon', 'transport is a safe constant, never caller-controlled');
    assert.doesNotMatch(JSON.stringify(hosted.calls), /private-|pay_privateGateway/);
    for (const path of ['/admin/curator', '/host', '/events/fixture-164?ticket=private-token', '/events/fixture-164/ticket']) {
      hosted.win.history.pushState({}, '', path);
      trackHostedStage('view_item', hostedItem);
      trackBookingCheckout(venueItem);
    }
    assert.equal(hosted.events().length, 11, 'private routes reject explicit funnel traffic too');
    trackBookingPurchase({ ...venueItem, code: 'SCN-PRIVATE' });
    assert.equal(hosted.win.localStorage.getItem('scene044:analytics:purchase:SCN-PRIVATE'), undefined, 'suppressed purchase is not marked delivered');

    const blocked = fixture('https://scene044.in/venues/fixture-cafe');
    setWindow(blocked.win);
    blocked.win.dataLayer.push = () => { throw new Error('analytics blocked'); };
    assert.doesNotThrow(() => blocked.win.history.pushState({}, '', '/events/fixture-164'));
    assert.doesNotThrow(() => trackHostedStage('begin_checkout', hostedItem));
    await assert.doesNotReject(trackHostedPurchase(hostedItem, 'pay_blocked'));
    assert.equal(blocked.calls.filter(c => c[1] === 'purchase').length, 0);
    blocked.win.history.pushState({}, '', '/bookings');
    assert.doesNotThrow(() => trackBookingPurchase({ ...venueItem, code: 'SCN-BLOCKED' }));
    assert.equal(blocked.win.localStorage.getItem('scene044:analytics:purchase:SCN-BLOCKED'), undefined, 'blocked purchase is not marked delivered');
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', { configurable: true, value: oldWindow });
    else Reflect.deleteProperty(globalThis, 'window');
  }

  const source = readFileSync('components/venues/figma/MyBookingsPage.tsx', 'utf8');
  const verification = source.indexOf('const verified = await fetch("/api/razorpay/verify-payment"');
  const verificationGuard = source.indexOf('if (!verified)', verification);
  const purchase = source.indexOf('trackBookingPurchase(analyticsItem);', verificationGuard);
  assert.ok(verification >= 0 && verificationGuard > verification && purchase > verificationGuard, 'booking purchase stays after server verification');
  console.log('PASS analytics privacy: public titles and validated UTM campaign attribution, private initial/soft routes and attribution exclusion, sanitized URL/referrer, single public pageviews, native history behavior, booking/hosted funnels and deduplicated purchases, raw payment/PII exclusion, inert failures; no network or real GA events');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
