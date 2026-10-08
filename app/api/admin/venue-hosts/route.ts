import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { approveHost, isSameOriginMutation, listApprovedHosts, listHostVenues } from '@/lib/venueHostAccess';
import { normalizeIndianPhone } from '@/lib/venueUserAuth';

export async function GET(request: Request) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const [hosts, venues] = await Promise.all([listApprovedHosts(), listHostVenues()]);
    return NextResponse.json({ hosts, venues }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load host access. Please retry.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Use the curator page to change access.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.phone !== 'string' || !normalizeIndianPhone(body.phone) ||
      (body.label !== undefined && (typeof body.label !== 'string' || body.label.length > 120)) ||
      (body.venueSlug !== undefined && (typeof body.venueSlug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(body.venueSlug)))) {
    return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number and an optional name (up to 120 characters).' }, { status: 400 });
  }
  try {
    if (!await approveHost(body.phone, body.label ?? '', body.venueSlug)) return NextResponse.json({ error: 'Select a registered venue.' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not save host access. Please retry.' }, { status: 503 });
  }
}
