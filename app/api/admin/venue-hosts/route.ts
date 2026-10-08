import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { approveHost, isSameOriginMutation, listApprovedHosts } from '@/lib/venueHostAccess';
import { normalizeIndianPhone } from '@/lib/venueUserAuth';

export async function GET(request: Request) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ hosts: await listApprovedHosts() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Use the curator page to change access.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.phone !== 'string' || !normalizeIndianPhone(body.phone) ||
      (body.label !== undefined && (typeof body.label !== 'string' || body.label.length > 120))) {
    return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number and an optional name (up to 120 characters).' }, { status: 400 });
  }
  await approveHost(body.phone, body.label ?? '');
  return NextResponse.json({ ok: true });
}
