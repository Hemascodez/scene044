import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { restoreArchivedBooking } from '@/lib/venueBookingArchive';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  return await restoreArchivedBooking(id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Archived booking not found' }, { status: 404 });
}
