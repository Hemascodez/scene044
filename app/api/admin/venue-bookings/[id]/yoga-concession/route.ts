import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { applyYogaThreeHourConcession } from '@/lib/venueOperations';

/** Curator-only, one-booking agreed rate: ₹5,000 paid, ₹5,000 to host, no SCENE fee. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const code = body && typeof body === 'object' && 'bookingCode' in body ? body.bookingCode : null;
  if (typeof code !== 'string' || !/^SCN-[A-Z0-9]{6}$/.test(code)) {
    return NextResponse.json({ error: 'A matching booking reference is required.' }, { status: 400 });
  }

  try {
    const applied = await applyYogaThreeHourConcession(id, code);
    if (!applied) return NextResponse.json({ error: 'Only the specified unpaid three-hour Chennai Yoga Studio request at ₹6,600, with no payment order, can receive this rate.' }, { status: 409 });
    return NextResponse.json({ ok: true, total: 5000, hostAmount: 5000, sceneAmount: 0 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const diagnostic = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    console.error('Could not apply Yoga Studio concession', diagnostic);
    return NextResponse.json({ error: 'Could not update the booking. Please retry before taking payment.' }, { status: 503 });
  }
}
