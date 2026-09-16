import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { addBookingOrder, listBookingOrders } from "@/lib/venueBookings";

interface OrderBody {
  description?: unknown;
  amount?: unknown;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: "invalid booking id" }, { status: 400 });
  }
  const orders = await listBookingOrders(bookingId);
  return NextResponse.json({ ok: true, orders });
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

  let body: OrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
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
