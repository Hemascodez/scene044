import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { listVenueBookings, orderTotalsByBooking } from "@/lib/venueBookings";

/** proxy.ts already gates /api/host/:path*; this check stays here too so the
 *  route is still closed if the matcher is ever edited. */
export async function GET(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const venueSlug = new URL(request.url).searchParams.get("venueSlug") ?? "time-cafe";
  const [bookings, orderTotals] = await Promise.all([
    listVenueBookings(venueSlug),
    orderTotalsByBooking(venueSlug),
  ]);

  return NextResponse.json({
    ok: true,
    bookings: bookings.map((booking) => ({
      ...booking,
      orderTotal: orderTotals.get(booking.id) ?? 0,
    })),
  });
}
