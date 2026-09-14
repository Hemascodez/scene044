import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { listPendingReviews } from "@/lib/venueBookings";

/** Self-reported reviews awaiting approval — the curator queue that keeps the
 *  open review flow (app/api/venues/[slug]/reviews) honest without a booking
 *  gate. Booking-backed reviews never appear here; they publish on arrival. */
export async function GET(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const reviews = await listPendingReviews();
    return NextResponse.json({ ok: true, reviews });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
