/** Explicit allowlist: never pass an organiser's name, email, phone, profile
 * link, message, check-in token or gateway credentials into analytics. */
type Item = { venueSlug: string; spaceId: string; value: number };
type AnalyticsWindow = Window & { gtag?: (action: 'event', name: string, params: Record<string, unknown>) => void };

function send(name: string, item: Item, extra: Record<string, unknown> = {}): boolean {
  if (typeof window === 'undefined' || !Number.isFinite(item.value) || item.value < 0) return false;
  const gtag = (window as AnalyticsWindow).gtag;
  if (typeof gtag !== 'function') return false;
  try {
    gtag('event', name, {
      currency: 'INR', value: item.value,
      items: [{ item_id: `${item.venueSlug}/${item.spaceId}`, item_category: 'Venue booking', quantity: 1, price: item.value }],
      ...extra,
    });
    return true;
  } catch { return false; } // Analytics can never interrupt a booking/payment.
}

export function trackBookingRequest(item: Item) { send('generate_lead', item); }
export function trackBookingCheckout(item: Item) { send('begin_checkout', item); }

/** Call ONLY after server-confirmed capture (or recovery of that capture).
 * GA4 also deduplicates transaction_id; local storage prevents refresh/poll
 * re-emission. No tracking when the script is blocked/missing. */
export function trackBookingPurchase(item: Item & { code: string }) {
  if (typeof window === 'undefined' || !/^SCN-[A-Z0-9]+$/i.test(item.code)) return;
  const key = `scene044:analytics:purchase:${item.code}`;
  try { if (window.localStorage.getItem(key)) return; } catch { /* blocked storage */ }
  if (send('purchase', item, { transaction_id: item.code })) {
    try { window.localStorage.setItem(key, '1'); } catch { /* GA4 still deduplicates */ }
  }
}
