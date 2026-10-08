import { NextResponse } from "next/server";
import { getHostVenueSlug } from "@/lib/venueHostAccess";
import { listVenueBookings, orderTotalsByBooking } from "@/lib/venueBookings";

/** proxy.ts already gates /api/host/:path*; this check stays here too so the
 *  route is still closed if the matcher is ever edited. */
export async function GET(request: Request) {
  const venueSlug = await getHostVenueSlug(request);
  if (!venueSlug) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
  }, { headers: { 'Cache-Control': 'no-store' } });
}
