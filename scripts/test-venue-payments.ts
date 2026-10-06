import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { fetchCapturedPayment, verifyRazorpayPaymentSignature, paymentForOrder } from '../lib/razorpay';
async function main() {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_fixture';
  process.env.RAZORPAY_KEY_SECRET = 'fixture-secret-not-a-real-credential';
  const signature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update('order_fixture|pay_fixture').digest('hex');
  assert.equal(verifyRazorpayPaymentSignature({ orderId: 'order_fixture', paymentId: 'pay_fixture', signature }), true);
  assert.equal(verifyRazorpayPaymentSignature({ orderId: 'order_other', paymentId: 'pay_fixture', signature }), false);
  const original = globalThis.fetch;
  const calls: { url: string; method?: string }[] = [];
  const payment = { id: 'pay_fixture', order_id: 'order_fixture', amount: 1000, currency: 'INR', status: 'authorized' };
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push({ url, method: init?.method });
    if (url.endsWith('/payments') && !url.endsWith('/pay_fixture/payments')) return Response.json({ items: [payment] });
    return Response.json({ ...payment, status: url.endsWith('/capture') ? 'captured' : 'authorized' });
  };
  try {
    await assert.rejects(fetchCapturedPayment('pay_fixture', { orderId: 'order_other', amountPaise: 1000, currency: 'INR' }));
    await assert.rejects(fetchCapturedPayment('pay_fixture', { orderId: 'order_fixture', amountPaise: 100, currency: 'INR' }));
    assert.equal(calls.filter(c => c.method === 'POST').length, 0, 'mismatched payments must not be captured');
    assert.equal((await paymentForOrder('order_fixture'))?.id, 'pay_fixture');
    assert.equal((await fetchCapturedPayment('pay_fixture', { orderId: 'order_fixture', amountPaise: 1000, currency: 'INR' })).status, 'captured');
    assert.equal(calls.filter(c => c.method === 'POST').length, 1);
    console.log('PASS: signature binding, wrong order/amount rejected before capture, captured-payment verification, interrupted-checkout recovery. No gateway calls made.');
  } finally { globalThis.fetch = original; }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Verification failed'); process.exitCode = 1; });
