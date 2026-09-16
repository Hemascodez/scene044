import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { setBookingStatus, type VenueBookingStatus } from "@/lib/venueBookings";

const HOST_SETTABLE: readonly VenueBookingStatus[] = ["approved", "declined", "cancelled"];

interface StatusBody {
  status?: unknown;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: "invalid booking id" }, { status: 400 });
  }

  let body: StatusBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const status = body.status;
  if (typeof status !== "string" || !HOST_SETTABLE.includes(status as VenueBookingStatus)) {
    return NextResponse.json({ error: "status must be one of approved, declined, cancelled" }, { status: 400 });
  }

  // `setBookingStatus` itself re-checks the transition against the row's
  // current status inside the UPDATE's WHERE clause — this earlier check is
  // just what turns an invalid request into a clear 400 instead of a
  // same-shaped "no rows updated" null.
  const updated = await setBookingStatus(bookingId, status as VenueBookingStatus);
  if (!updated) {
    return NextResponse.json(
      { error: "That booking can't move to this status right now" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, booking: updated });
}
