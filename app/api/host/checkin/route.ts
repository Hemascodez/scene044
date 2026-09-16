import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { checkInBooking, getBookingByCheckinToken, getBookingByCode } from "@/lib/venueBookings";

interface CheckinBody {
  token?: unknown;
  code?: unknown;
}

export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CheckinBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!token && !code) return NextResponse.json({ error: "token or code is required" }, { status: 400 });

  // Scanning the QR gives the token; a host typing the code at reception
  // (camera unavailable, or faster than pulling one up) gives the code —
  // either identifies the same booking.
  const booking = token ? await getBookingByCheckinToken(token) : await getBookingByCode(code);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // checkInBooking only succeeds from `confirmed` (payment already verified);
  // anything else — including a second scan — is a no-op, not an error, so a
  // host re-scanning an already-checked-in QR just sees the current state.
  const checkedIn = await checkInBooking(booking.id);
  return NextResponse.json({ ok: true, booking: checkedIn ?? booking });
}
