import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay";
import { getBookingByCheckinToken } from "@/lib/venueBookings";
import { getCatalogVenue } from "@/lib/venueCatalog";
import { rateForSpace } from "@/lib/venues";

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
  let body: CreateOrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "token is required" }, { status: 400 });

  const booking = await getBookingByCheckinToken(token);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "approved") {
    return NextResponse.json({ error: "This booking isn't ready for payment" }, { status: 409 });
  }

  const venue = await getCatalogVenue(booking.venueSlug);
  const space = venue?.spaces.find((item) => item.id === booking.spaceId);
  if (!venue || !space) {
    return NextResponse.json({ error: "Unknown venue or space" }, { status: 400 });
  }

  const rate = rateForSpace(space, booking.eventType);
  if (rate === null) {
    return NextResponse.json(
      { error: "This space requires a manual quote and can't be paid online yet" },
      { status: 400 },
    );
  }

  const amountPaise = Math.round(rate * booking.durationHours * 100);
  if (amountPaise < 100) {
    return NextResponse.json({ error: "Amount must be at least ₹1" }, { status: 400 });
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

  return NextResponse.json({
    ok: true,
    orderId: result.order.id,
    amount: result.order.amount,
    currency: result.order.currency,
  });
}
