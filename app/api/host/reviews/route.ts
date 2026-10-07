import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { listVenueReviews } from '@/lib/venueBookings';

export async function GET(request: Request) {
  if (!(await checkCuratorAccess(request))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const reviews = await listVenueReviews('time-cafe');
    return NextResponse.json({ ok: true, reviews }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Host reviews could not load', error);
    return NextResponse.json({ error: 'Could not load reviews. Please retry.' }, { status: 503 });
  }
}
