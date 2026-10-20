import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { applyYogaPrivateBookingCorrection } from '@/lib/venueOperations';

/** No public package or trial: an explicit curator correction for one booking. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'A booking reference and agreed host payout are required.' }, { status: 400 });
  const code = 'bookingCode' in body ? body.bookingCode : null;
  const hostAmount = 'hostAmount' in body ? body.hostAmount : null;
  if (typeof code !== 'string' || !/^SCN-[A-Z0-9]{6}$/.test(code) || (hostAmount !== 5000 && hostAmount !== 5500)) {
    return NextResponse.json({ error: 'A matching booking reference and explicit host payout of ₹5,000 or ₹5,500 are required.' }, { status: 400 });
  }
  try {
    if (!await applyYogaPrivateBookingCorrection(id, code, hostAmount)) {
      return NextResponse.json({ error: 'Only the specified approved, unpaid Yoga Studio booking at ₹6,600 for 3 or 4 hours, without any payment order or trial, can be corrected. Refresh before taking payment.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, total: 5500, durationHours: 3.5, hostAmount, sceneAmount: 5500 - hostAmount }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const diagnostic = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    console.error('Private Yoga booking correction failed', diagnostic);
    return NextResponse.json({ error: 'The booking could not be updated. Do not pay the earlier amount; retry or contact SCENE.' }, { status: 503 });
  }
}
