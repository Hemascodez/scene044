import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { listCuratorBookings } from '@/lib/venueOperations';
export async function GET(request: Request) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const page = Number(new URL(request.url).searchParams.get('page') || 1);
  if (!Number.isSafeInteger(page) || page < 1) return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  const archived = new URL(request.url).searchParams.get('archived') === 'true';
  try {
    return NextResponse.json(await listCuratorBookings(page, archived), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // Log a diagnostic code only; database exceptions may contain customer data.
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    console.error('Curator bookings unavailable', code);
    return NextResponse.json({ error: 'Bookings are temporarily unavailable. Please retry.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
