import { NextResponse } from "next/server";
import { getBookingByCheckinToken } from "@/lib/venueBookings";

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
