import { NextResponse } from "next/server";
import { getBookingByCheckinToken, withdrawRequestedBooking } from "@/lib/venueBookings";
import { getVenueUserFromRequest } from "@/lib/venueUserAuth";
import { scheduleVenueNotifications } from '@/lib/venueNotificationAfter';

/**
 * The organizer's own "what's the live status of my booking" read.
 *
 * A verified account must own the booking. The check-in token is used to
 * locate it, but possession of that token alone is not organizer access.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { token } = await params;
  const booking = await getBookingByCheckinToken(token);
  if (!booking || booking.organizerUserId !== user.id) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  return NextResponse.json({ ok: true, booking }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * The organizer withdraws a request the host has not answered yet.
 *
 * Same ownership gate as GET. Only a `requested` booking can be withdrawn;
 * anything the host has already acted on returns 409 and is left untouched.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { token } = await params;
  const booking = await getBookingByCheckinToken(token);
  if (!booking || booking.organizerUserId !== user.id) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const withdrawn = await withdrawRequestedBooking(booking.id);
  if (!withdrawn) {
    return NextResponse.json(
      { error: "The host has already responded to this request, so it can't be withdrawn here." },
      { status: 409 },
    );
  }
  scheduleVenueNotifications();
  return NextResponse.json({ ok: true, booking: withdrawn });
}
