import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/** Public names only, never staff numbers or membership records. */
export async function GET() {
  try {
    const { rows } = await query<{ slug: string; name: string }>(`SELECT v.slug, v.name FROM venues v
      WHERE v.status = 'live' AND EXISTS (SELECT 1 FROM venue_host_access h
        WHERE h.venue_slug = v.slug AND h.revoked_at IS NULL) ORDER BY v.name, v.slug`);
    return NextResponse.json({ venues: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load venues. Please reopen sign-in to retry.' }, { status: 503 });
  }
}
