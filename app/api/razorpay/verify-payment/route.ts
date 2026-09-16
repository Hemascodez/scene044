import { NextResponse } from "next/server";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";

/**
 * Verifies the signature Razorpay Checkout hands back after a payment.
 *
 * This is the only step allowed to call a booking paid: the client cannot be
 * trusted to self-report success, so `handler(response)` on the frontend must
 * wait for `{ ok: true }` from here before it flips the booking to
 * "confirmed" — a forged or replayed payment_id fails the signature check and
 * gets a 400, never a paid booking.
 */

interface VerifyPaymentBody {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
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

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json(
      { error: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required" },
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

  return NextResponse.json({ ok: true });
}
