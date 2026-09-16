import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { completeBooking } from "@/lib/venueBookings";

/** Separate from the generic status route because completing a booking also
 *  stamps `completed_at` — `completeBooking` is the one place that does
 *  both atomically, unlike the generic `setBookingStatus`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: "invalid booking id" }, { status: 400 });
  }

  const updated = await completeBooking(bookingId);
  if (!updated) {
    return NextResponse.json({ error: "That booking isn't checked in" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, booking: updated });
}
