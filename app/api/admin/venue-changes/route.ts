import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { isSameOriginMutation } from '@/lib/venueHostAccess';

export async function GET(request: Request) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const [changes, unread] = await Promise.all([
      query(`SELECT c.id::text, c.venue_slug AS "venueSlug",v.name AS "venueName", c.actor_name AS "actorName",c.field,c.created_at AS "createdAt",c.read_at AS "readAt" FROM venue_host_changes c JOIN venues v ON v.slug=c.venue_slug ORDER BY c.id DESC LIMIT 100`),
      query('SELECT count(*)::int AS count FROM venue_host_changes WHERE read_at IS NULL'),
    ]);
    return NextResponse.json({ changes: changes.rows, unread: unread.rows[0].count }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Could not load host changes. Please retry.' }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Use the curator page.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.ids) || body.ids.length > 100 || !body.ids.every((id: unknown) => typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id))) return NextResponse.json({ error: 'Choose valid changes.' }, { status: 400 });
  try {
    await query('UPDATE venue_host_changes SET read_at=now() WHERE id=ANY($1::bigint[]) AND read_at IS NULL', [body.ids]);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Could not mark changes as read.' }, { status: 503 }); }
}
