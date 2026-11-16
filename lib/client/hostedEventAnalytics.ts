/** Hosted-event funnel: explicit non-personal fields only. Never send form values or bearer ticket codes. */
type Item = { eventId: number; amountPaise: number };
type Stage = 'view_item' | 'scene_registration_open' | 'scene_otp_sent' | 'scene_otp_verified' | 'scene_details_completed' | 'begin_checkout' | 'scene_checkout_dismissed' | 'scene_payment_failed';
type GAWindow = Window & { gtag?: (action: 'event', name: string, params: Record<string, unknown>) => void };

function send(name: Stage | 'purchase', item: Item, extra: Record<string, unknown> = {}): boolean {
  if (typeof window === 'undefined' || !Number.isSafeInteger(item.eventId) || item.eventId < 1 || !Number.isSafeInteger(item.amountPaise) || item.amountPaise < 0) return false;
  // Local previews, private ticket links and curator/host workspaces must never create funnel traffic.
  if (!/^(?:www\.)?scene044\.in$/.test(window.location.hostname) || !/^\/events\/[^/]+\/?$/.test(window.location.pathname) || new URLSearchParams(window.location.search).has('ticket')) return false;
  const gtag = (window as GAWindow).gtag;
  if (typeof gtag !== 'function') return false;
  const value = item.amountPaise / 100;
  try {
    gtag('event', name, {
      currency: 'INR', value, scene_event_id: String(item.eventId),
      page_location: `${window.location.origin}${window.location.pathname}`,
      items: [{ item_id: `scene-event-${item.eventId}`, item_category: 'Hosted event', quantity: 1, price: value }],
      transport_type: 'beacon', ...extra,
    });
    return true;
  } catch { return false; } // Analytics must never break OTP, payment or ticket generation.
}

export function trackHostedStage(stage: Stage, item: Item) { return send(stage, item); }

/** Call only AFTER the server verifies a captured payment. Hashing avoids sharing raw gateway IDs. */
export async function trackHostedPurchase(item: Item, paymentId: string): Promise<void> {
  if (typeof window === 'undefined' || !/^pay_[a-zA-Z0-9]+$/.test(paymentId)) return;
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(paymentId));
    const transactionId = `evt-${item.eventId}-${Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)}`;
    const key = `scene:hosted-purchase:${transactionId}`;
    try { if (window.localStorage.getItem(key)) return; } catch { /* GA4 also deduplicates transaction_id. */ }
    if (send('purchase', item, { transaction_id: transactionId })) {
      try { window.localStorage.setItem(key, '1'); } catch { /* blocked storage */ }
    }
  } catch { /* Crypto or analytics blocked: payment still succeeds. */ }
}
