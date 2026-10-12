import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createVenueBooking, listBookingsForOrganizer, organizerBooking } from "@/lib/venueBookings";
import { getCatalogVenue, quoteCatalogSpace } from "@/lib/venueCatalog";
import { isProductionEvent, VENUE_EVENT_TYPES } from "@/lib/venues";
import { HOURLY_ID, BookingPricingError } from '@/lib/venuePricing';
import { absoluteUrl } from "@/lib/seo";
import { getVenueUserFromRequest } from "@/lib/venueUserAuth";
import { deleteVenueBookingDraft } from "@/lib/venueBookingDrafts";
import { validateVenueBookingWindow } from "@/lib/venueBookingValidation";
import { scheduleVenueNotifications } from '@/lib/venueNotificationAfter';

/**
 * Creates a real, server-side booking request (replaces the old
 * localStorage-only flow). The rate is re-derived from the venue's own space
 * here too — same reasoning as /api/razorpay/create-order: a client-supplied
 * price is a price anyone could tamper with.
 */

interface CreateBookingBody {
  venueSlug?: unknown;
  spaceId?: unknown;
  eventType?: unknown;
  date?: unknown;
  time?: unknown;
  duration?: unknown;
  packageId?: unknown;
  expectedTotal?: unknown;
  people?: unknown;
  description?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  trustType?: unknown;
  trustUrl?: unknown;
  whatsappOptIn?: unknown;
  emailOptIn?: unknown;
}

function cleanString(value: unknown, max = 300): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

export async function GET(request: Request) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to see your bookings." }, { status: 401 });
  const bookings = await listBookingsForOrganizer(user.id);
  const entries = await Promise.all(bookings.map(async (booking) => ({
    booking: organizerBooking(booking),
    qrSvg: await QRCode.toString(absoluteUrl(`/host/checkin/${booking.checkinToken}`), { type: "svg", margin: 1, width: 256 }),
  })));
  return NextResponse.json({ ok: true, entries }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Verify your WhatsApp number before booking." }, { status: 401 });
  let body: CreateBookingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid booking details' }, { status: 400 });
  }

  const venueSlug = cleanString(body.venueSlug, 100);
  const spaceId = cleanString(body.spaceId, 100);
  const eventType = cleanString(body.eventType, 100);
  const date = cleanString(body.date, 20);
  const time = cleanString(body.time, 10);
  const duration = Number(body.duration);
  const people = Number(body.people);
  const description = cleanString(body.description, 4000);
  const name = user.name;
  const email = user.email ?? cleanString(body.email, 300);
  const phone = `+${user.phoneE164}`;
  const trustType = cleanString(body.trustType, 40);
  const trustUrl = cleanString(body.trustUrl, 500);
  const whatsappOptIn = body.whatsappOptIn === true;
  const emailOptIn = body.emailOptIn === true;

  if (
    !venueSlug || !spaceId || !eventType || !date || !time ||
    !Number.isFinite(duration) || duration <= 0 ||
    !Number.isInteger(people) || people <= 0 ||
    !description || !name || !email || !/^\S+@\S+\.\S+$/.test(email) || !phone
  ) {
    return NextResponse.json({ error: "Missing or invalid booking details" }, { status: 400 });
  }
  if (!VENUE_EVENT_TYPES.includes(eventType as (typeof VENUE_EVENT_TYPES)[number])) {
    return NextResponse.json({ error: "Unknown event type" }, { status: 400 });
  }
  const invalidWindow = validateVenueBookingWindow(date, time, duration);
  if (invalidWindow) return NextResponse.json({ error: invalidWindow.error, field: invalidWindow.field }, { status: 400 });

  const venue = await getCatalogVenue(venueSlug);
  const space = venue?.spaces.find((item) => item.id === spaceId);
  if (venue?.status !== "live" || !space) {
    return NextResponse.json({ error: "Unknown venue or space" }, { status: 400 });
  }
  if (people > space.maxGuests) {
    return NextResponse.json({ error: `${space.name} supports up to ${space.maxGuests} people` }, { status: 400 });
  }

  if (body.packageId !== undefined && (typeof body.packageId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(body.packageId))) {
    return NextResponse.json({ error: 'Invalid booking option.' }, { status: 400 });
  }
  let quote;
  try {
    quote = await quoteCatalogSpace(venue.id, space.id, isProductionEvent(eventType), duration, body.packageId as string | undefined ?? HOURLY_ID);
  } catch (error) {
    if (error instanceof BookingPricingError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Could not price venue booking', error instanceof Error ? error.name : 'Error');
    return NextResponse.json({ error: 'Could not check the current price. Please retry.' }, { status: 503 });
  }
  if (quote.pricingModel === 'host-markup' && (body.packageId === undefined || typeof body.expectedTotal !== 'number')) {
    return NextResponse.json({ error: 'Refresh the venue page to see its current booking options and prices.' }, { status: 409 });
  }
  if (body.expectedTotal !== undefined && body.expectedTotal !== quote.total) {
    return NextResponse.json({ error: 'The price has changed. Refresh the venue page and review the total before sending your request.' }, { status: 409 });
  }

  const booking = await createVenueBooking({
    organizerUserId: user.id,
    venueSlug: venue.slug,
    venueName: venue.name,
    spaceId: space.id,
    spaceName: space.name,
    eventDate: date,
    startTime: time,
    durationHours: duration,
    people,
    eventType,
    description,
    organizerName: name,
    organizerEmail: email,
    organizerPhone: phone,
    trustType,
    trustUrl,
    whatsappOptIn,
    emailOptIn,
    ...quote,
  });

  // The booking is already real at this point. A failed cleanup must never
  // turn its successful POST into an error that invites a duplicate request.
  try {
    await deleteVenueBookingDraft(user.id, venue.slug, space.id);
  } catch (error) {
    console.error("Could not clear submitted venue draft", error);
  }

  const checkinUrl = absoluteUrl(`/host/checkin/${booking.checkinToken}`);
  scheduleVenueNotifications();
  const qrSvg = await QRCode.toString(checkinUrl, { type: "svg", margin: 1, width: 256 });

  return NextResponse.json({
    ok: true,
    id: booking.id,
    code: booking.code,
    token: booking.checkinToken,
    status: booking.status,
    total: booking.total,
    packageId: booking.packageId,
    packageName: booking.packageName,
    qrSvg,
  });
}
