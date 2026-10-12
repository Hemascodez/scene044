import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { getCatalogVenue } from '@/lib/venueCatalog';
import { parseSpacePricing } from '@/lib/venuePricing';

/** Curator-only package agreements. Hosts cannot change SCENE's markup. */
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; rowId: string }> }) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug, rowId } = await params;
  const id = Number(rowId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid room.' }, { status: 400 });
  let config;
  try { config = parseSpacePricing((await request.json()).pricing); }
  catch { return NextResponse.json({ error: 'Invalid package pricing.' }, { status: 400 }); }
  if (!config) return NextResponse.json({ error: 'Provide the room pricing configuration.' }, { status: 400 });
  const result = await query(`UPDATE venue_spaces s SET pricing_options=$3::jsonb, pricing_initialized=true, updated_at=now()
    WHERE id=$2 AND venue_id=(SELECT id FROM venues WHERE slug=$1) AND retired_at IS NULL`, [slug, id, JSON.stringify(config)]);
  if (!result.rowCount) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, space: (await getCatalogVenue(slug))?.spaces.find(s => s.rowId === id) });
}
