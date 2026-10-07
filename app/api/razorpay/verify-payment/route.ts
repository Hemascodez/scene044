import { NextResponse } from "next/server";
import { verifyRazorpayPaymentSignature, fetchCapturedPayment } from "@/lib/razorpay";
import { getBookingByCheckinToken } from "@/lib/venueBookings";
import { getVenueUserFromRequest } from "@/lib/venueUserAuth";
import { bookingChargePaise, confirmCapturedPayment, getPaymentOrder } from '@/lib/venueOperations';

/**
 * Verifies the signature Razorpay Checkout hands back after a payment, then
 * — and only then — advances the real booking record from `approved` to
 * `confirmed`.
 *
 * This is the only step allowed to call a booking paid: the client cannot be
 * trusted to self-report success, so the frontend's `handler(response)` must
 * wait for `{ ok: true }` from here — a forged or replayed payment_id fails
 * the signature check and gets a 400, never a confirmed booking.
 */

interface VerifyPaymentBody {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
  token?: unknown;
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  let body: VerifyPaymentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const orderId = cleanString(body.razorpay_order_id);
  const paymentId = cleanString(body.razorpay_payment_id);
  const signature = cleanString(body.razorpay_signature);
  const token = cleanString(body.token);

  if (!orderId || !paymentId || !signature || !token) {
    return NextResponse.json(
      { error: "razorpay_order_id, razorpay_payment_id, razorpay_signature, and token are required" },
      { status: 400 },
    );
  }

  let verified: boolean;
  try {
    verified = verifyRazorpayPaymentSignature({ orderId, paymentId, signature });
  } catch (err) {
    console.error("razorpay verify-payment: misconfigured", err);
    return NextResponse.json({ error: "Payments are not configured yet." }, { status: 500 });
  }

  if (!verified) {
    return NextResponse.json({ ok: false, error: "Signature mismatch" }, { status: 400 });
  }

  const booking = await getBookingByCheckinToken(token);
  if (!booking || booking.organizerUserId !== user.id) return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });

  // A verified signature for a booking that isn't `approved` (already paid,
  // or paid out of order) still leaves the payment itself valid — it just
  // shouldn't move a booking that's already past this step.
  const order = await getPaymentOrder(orderId);
  if (!order || order.bookingId !== booking.id || (order.paymentId && order.paymentId !== paymentId)) {
    return NextResponse.json({ error: 'This payment order does not belong to this booking.' }, { status: 400 });
  }
  if (booking.status === 'approved' && order.amountPaise !== bookingChargePaise(booking)) {
    return NextResponse.json({ error: 'This earlier payment order has a different price. Contact SCENE to reconcile it; no capture has been attempted.' }, { status: 409 });
  }
  try {
    const payment = await fetchCapturedPayment(paymentId, { orderId, amountPaise: order.amountPaise, currency: order.currency });
    if (payment.order_id !== orderId || payment.amount !== order.amountPaise || payment.currency !== order.currency || payment.status !== 'captured') {
      return NextResponse.json({ error: 'Payment has not been captured for the expected booking amount.' }, { status: 409 });
    }
    if (!await confirmCapturedPayment(booking.id, orderId, paymentId)) {
      return NextResponse.json({ error: 'Payment received, but the booking needs curator attention.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, booking: await getBookingByCheckinToken(token) });
  } catch (error) {
    console.error('Razorpay payment reconciliation failed', error);
    return NextResponse.json({ error: 'Could not verify the captured payment. Retry verification or contact SCENE with your payment ID.' }, { status: 502 });
  }
}
