import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { venueNotificationsEnabled } from '@/lib/venueNotifications';

export async function GET(request: Request) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const counts = await query('SELECT state,COUNT(*)::int AS count FROM venue_notifications GROUP BY state');
  const issues = await query(`SELECT id,kind,audience,state,attempts,error,updated_at FROM venue_notifications
    WHERE state IN ('failed','unknown') ORDER BY updated_at DESC LIMIT 20`);
  return NextResponse.json({ enabled: venueNotificationsEnabled(), workerStarted: Boolean(globalThis.__venueNotificationTimer),
    lastSweepAt: globalThis.__venueNotificationLastSweep ?? null, counts: counts.rows, issues: issues.rows }, { headers: { 'Cache-Control': 'no-store' } });
}
