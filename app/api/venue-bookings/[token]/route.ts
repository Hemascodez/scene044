import { NextResponse } from "next/server";
import { getBookingByCheckinToken, withdrawRequestedBooking } from "@/lib/venueBookings";

/**
 * The organizer's own "what's the live status of my booking" read.
 *
 * Gated by possession of the checkin token rather than a login — the token is
 * 48 hex characters from `crypto.randomBytes`, effectively unguessable, unlike
 * the human-readable `code` (meant to be read aloud, never a secret).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await getBookingByCheckinToken(token);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  return NextResponse.json({ ok: true, booking });
}

/**
 * The organizer withdraws a request the host has not answered yet.
 *
 * Same bearer-token gate as GET. Only a `requested` booking can be withdrawn;
 * anything the host has already acted on returns 409 and is left untouched.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await getBookingByCheckinToken(token);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const withdrawn = await withdrawRequestedBooking(booking.id);
  if (!withdrawn) {
    return NextResponse.json(
      { error: "The host has already responded to this request, so it can't be withdrawn here." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, booking: withdrawn });
}
