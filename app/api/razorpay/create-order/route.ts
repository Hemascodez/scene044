import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay";
import { getCatalogVenue } from "@/lib/venueCatalog";
import { rateForSpace } from "@/lib/venues";

/**
 * Creates a Razorpay order for a venue booking's "Pay & confirm" step.
 *
 * The amount is never taken from the client — it is re-derived here from the
 * venue's own space rate, exactly the way BookingFlow.tsx computes it for
 * display. A client-supplied amount would let a tampered request pay ₹1 for a
 * ₹10,000 booking; the server has to be the one source of truth for price.
 */

interface CreateOrderBody {
  venueSlug?: unknown;
  spaceId?: unknown;
  eventType?: unknown;
  duration?: unknown;
  receipt?: unknown;
}

function cleanString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

export async function POST(request: Request) {
  let body: CreateOrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const venueSlug = cleanString(body.venueSlug);
  const spaceId = cleanString(body.spaceId);
  const eventType = cleanString(body.eventType);
  const duration = Number(body.duration);
  const receipt = cleanString(body.receipt, 40) ?? `booking-${Date.now()}`;

  if (!venueSlug || !spaceId || !eventType || !Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json(
      { error: "venueSlug, spaceId, eventType, and a positive duration are required" },
      { status: 400 },
    );
  }

  const venue = await getCatalogVenue(venueSlug);
  const space = venue?.spaces.find((item) => item.id === spaceId);
  if (!venue || !space) {
    return NextResponse.json({ error: "Unknown venue or space" }, { status: 400 });
  }

  const rate = rateForSpace(space, eventType);
  if (rate === null) {
    return NextResponse.json(
      { error: "This space requires a manual quote and can't be paid online yet" },
      { status: 400 },
    );
  }

  const amountPaise = Math.round(rate * duration * 100);
  if (amountPaise < 100) {
    return NextResponse.json({ error: "Amount must be at least ₹1" }, { status: 400 });
  }

  let result;
  try {
    result = await createRazorpayOrder({ amountPaise, currency: "INR", receipt });
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
