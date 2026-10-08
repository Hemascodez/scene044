import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { isSameOriginMutation, revokeHost } from '@/lib/venueHostAccess';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Use the curator page to change access.' }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid access record.' }, { status: 400 });
  try {
    if (!await revokeHost(id)) return NextResponse.json({ error: 'Access was already removed or was not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not remove host access. Please retry.' }, { status: 503 });
  }
}
