import { NextResponse } from "next/server";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";
import { getBookingByCheckinToken, setBookingStatus } from "@/lib/venueBookings";

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
  if (!booking) return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });

  // A verified signature for a booking that isn't `approved` (already paid,
  // or paid out of order) still leaves the payment itself valid — it just
  // shouldn't move a booking that's already past this step.
  const confirmed = booking.status === "approved" ? await setBookingStatus(booking.id, "confirmed") : booking;

  return NextResponse.json({ ok: true, booking: confirmed ?? booking });
}
