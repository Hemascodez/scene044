/** Razorpay Orders API — order creation and payment signature verification. */

import crypto from "node:crypto";

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
}

export type RazorpayOrderResult =
  | { ok: true; order: RazorpayOrder }
  | { ok: false; status: number; error: string };

/** Missing keys throw rather than silently no-op: an order route that "worked"
 *  without ever reaching Razorpay would be a payment nobody actually took. */
function credentials(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must both be set");
  }
  return { keyId, keySecret };
}

export function razorpayCheckoutKey(): string { return credentials().keyId; }

export interface RazorpayPayment {
  id: string; order_id: string; amount: number; currency: string; status: string;
}

/** Recover a paid order if the browser closed before the success callback. */
export async function paymentForOrder(orderId: string): Promise<RazorpayPayment | null> {
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) throw new Error('Invalid order id');
  const { keyId, keySecret } = credentials();
  const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
    cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Could not check existing payment');
  const data = await response.json() as { items: RazorpayPayment[] };
  return data.items.find(p => p.status === 'captured' || p.status === 'authorized') ?? null;
}

export async function fetchCapturedPayment(paymentId: string, expected: { orderId: string; amountPaise: number; currency: string }): Promise<RazorpayPayment> {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new Error('Invalid payment id');
  const { keyId, keySecret } = credentials();
  const headers = { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' };
  let response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error('Could not retrieve payment from Razorpay');
  let payment = await response.json() as RazorpayPayment;
  if (payment.order_id !== expected.orderId || payment.amount !== expected.amountPaise || payment.currency !== expected.currency) throw new Error('Payment does not match the booking order');
  if (payment.status === 'authorized') {
    response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
      method: 'POST', headers, body: JSON.stringify({ amount: payment.amount, currency: payment.currency }),
    });
    if (!response.ok) throw new Error('Payment is authorised but could not be captured. Please retry verification.');
    payment = await response.json() as RazorpayPayment;
  }
  return payment;
}

/** `amountPaise` must already be the integer paise amount — Razorpay itself
 *  rejects anything below 100 paise (₹1), so the caller validates that first. */
export async function createRazorpayOrder(input: {
  amountPaise: number;
  currency: string;
  receipt: string;
}): Promise<RazorpayOrderResult> {
  const { keyId, keySecret } = credentials();

  let response: Response;
  try {
    response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        // Razorpay caps receipt at 40 characters.
        receipt: input.receipt.slice(0, 40),
      }),
    });
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : "network error" };
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message =
      (detail && typeof detail === "object" && "error" in detail
        ? (detail as { error?: { description?: string } }).error?.description
        : null) ?? `Razorpay order request failed (${response.status})`;
    return { ok: false, status: response.status === 401 ? 401 : 500, error: message };
  }

  const order = (await response.json()) as RazorpayOrder;
  return { ok: true, order };
}

/** HMAC-SHA256(order_id + "|" + payment_id, key_secret), compared with
 *  `crypto.timingSafeEqual` the same way lib/whatsappWebhook.ts verifies
 *  Meta's webhook signature. */
export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = credentials();
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(input.signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
