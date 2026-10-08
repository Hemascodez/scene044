import { NextResponse } from "next/server";
import { createRazorpayOrder, razorpayCheckoutKey, paymentForOrder, fetchCapturedPayment } from "@/lib/razorpay";
import { getBookingByCheckinToken } from "@/lib/venueBookings";
import { getCatalogVenue } from "@/lib/venueCatalog";
import { rateForSpace } from "@/lib/venues";
import { getVenueUserFromRequest } from "@/lib/venueUserAuth";
import { bookingChargePaise, recordPaymentOrder, latestPaymentOrder, confirmCapturedPayment } from '@/lib/venueOperations';
import { scheduleVenueNotifications } from '@/lib/venueNotificationAfter';

/**
 * Creates a Razorpay order for a venue booking's "Pay & confirm" step.
 *
 * The amount is never taken from the client — it is re-derived here from the
 * real server-side booking record (by its checkin token), which itself was
 * priced from the venue's own space rate at creation time. A client-supplied
 * amount would let a tampered request pay ₹1 for a ₹10,000 booking; the
 * server has to be the one source of truth for price.
 *
 * Only an `approved` booking can be paid — that's the transition Razorpay's
 * successful, verified payment then advances to `confirmed`
 * (see /api/razorpay/verify-payment).
 */

interface CreateOrderBody {
  token?: unknown;
}

export async function POST(request: Request) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  let body: CreateOrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "token is required" }, { status: 400 });

  const booking = await getBookingByCheckinToken(token);
  if (!booking || booking.organizerUserId !== user.id) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "approved") {
    return NextResponse.json({ error: "This booking isn't ready for payment" }, { status: 409 });
  }

  const venue = await getCatalogVenue(booking.venueSlug);
  const space = venue?.spaces.find((item) => item.id === booking.spaceId);
  if (!venue || !space) {
    return NextResponse.json({ error: "Unknown venue or space" }, { status: 400 });
  }

  const rate = rateForSpace(space, booking.eventType);
  if (rate === null && !booking.trialAmountPaise) {
    return NextResponse.json(
      { error: "This space requires a manual quote and can't be paid online yet" },
      { status: 400 },
    );
  }

  // Organiser pays the listed venue price. Commission is deducted host-side.
  const amountPaise = bookingChargePaise(booking);
  if (amountPaise === null || amountPaise < 100) {
    return NextResponse.json({ error: "Amount must be at least ₹1" }, { status: 400 });
  }

  const existing = await latestPaymentOrder(booking.id);
  if (existing) {
    if (existing.amountPaise !== amountPaise || existing.currency !== 'INR') {
      return NextResponse.json({ error: 'Your earlier payment order has a different price. Contact SCENE before paying; do not pay the old amount.' }, { status: 409 });
    }
    try {
      const payment = await paymentForOrder(existing.orderId);
      if (payment) {
        const captured = await fetchCapturedPayment(payment.id, existing);
        if (captured.status !== 'captured' || !await confirmCapturedPayment(booking.id, existing.orderId, captured.id)) throw new Error('Payment needs reconciliation');
        scheduleVenueNotifications();
        return NextResponse.json({ ok: true, alreadyPaid: true });
      }
      return NextResponse.json({ ok: true, orderId: existing.orderId, amount: existing.amountPaise, currency: existing.currency, keyId: razorpayCheckoutKey() });
    } catch {
      return NextResponse.json({ error: 'Could not check your earlier payment. Please retry; do not pay separately.' }, { status: 502 });
    }
  }

  let result;
  try {
    result = await createRazorpayOrder({ amountPaise, currency: "INR", receipt: booking.code });
  } catch (err) {
    console.error("razorpay create-order: misconfigured", err);
    return NextResponse.json({ error: "Payments are not configured yet." }, { status: 500 });
  }
  if (!result.ok) {
    console.error("razorpay create-order: failed", result.status, result.error);
    return NextResponse.json({ error: "Could not start payment. Try again shortly." }, { status: result.status });
  }

  if (!await recordPaymentOrder(booking.id, result.order.id, result.order.amount)) {
    return NextResponse.json({ error: 'This booking changed while payment was starting. Refresh your bookings.' }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    orderId: result.order.id,
    amount: result.order.amount,
    currency: result.order.currency,
    keyId: razorpayCheckoutKey(),
  });
}
