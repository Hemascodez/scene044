import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { prepareTrial } from '@/lib/venueOperations';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  return await prepareTrial(id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Only unpaid Time Cafe requests without a payment order can be marked as a trial.' }, { status: 409 });
}
