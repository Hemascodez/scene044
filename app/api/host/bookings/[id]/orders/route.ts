import { NextResponse } from "next/server";
import { checkHostAccess } from "@/lib/venueHostAccess";
import { addBookingOrder, listBookingOrders } from "@/lib/venueBookings";
import { addMenuOrder, UUID_PATTERN } from '@/lib/venueOperations';

interface OrderBody {
  description?: unknown;
  amount?: unknown;
  menuItemId?: unknown;
  quantity?: unknown;
  requestKey?: unknown;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await checkHostAccess(request, Number(id)))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const bookingId = Number(id);
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: "invalid booking id" }, { status: 400 });
  }
  const orders = await listBookingOrders(bookingId);
  return NextResponse.json({ ok: true, orders });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await checkHostAccess(request, Number(id)))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const bookingId = Number(id);
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: "invalid booking id" }, { status: 400 });
  }

  let body: OrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (body.menuItemId !== undefined) {
    if (typeof body.menuItemId !== 'string' || !UUID_PATTERN.test(body.menuItemId) ||
      typeof body.requestKey !== 'string' || !UUID_PATTERN.test(body.requestKey) ||
      !Number.isSafeInteger(body.quantity) || Number(body.quantity) < 1 || Number(body.quantity) > 100) return NextResponse.json({ error: 'Invalid menu item or quantity' }, { status: 400 });
    const order = await addMenuOrder(bookingId, body.menuItemId, Number(body.quantity), body.requestKey);
    return order ? NextResponse.json({ ok: true, order }) : NextResponse.json({ error: 'Item unavailable or booking is not checked in' }, { status: 409 });
  }
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 300) : "";
  const amount = Number(body.amount);
  if (!description || !Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "description and a non-negative amount are required" }, { status: 400 });
  }

  // Gated inside addBookingOrder itself: only a checked_in/completed booking
  // can accrue a food order — an event that never started can't run a tab.
  const order = await addBookingOrder(bookingId, description, Math.round(amount));
  if (!order) {
    return NextResponse.json({ error: "This booking hasn't checked in yet" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, order });
}
