import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { listMenuItems, saveMenuItems, validateMenuItems } from '@/lib/venueOperations';

export async function GET(request: Request) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ items: await listMenuItems() });
}
export async function PUT(request: Request) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const text = await request.text();
  if (text.length > 100000) return NextResponse.json({ error: 'Menu is too large' }, { status: 413 });
  let body;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const items = validateMenuItems(body.items);
  if (!items) return NextResponse.json({ error: 'Check every item name and price before saving (maximum 200 items).' }, { status: 400 });
  await saveMenuItems(items);
  return NextResponse.json({ ok: true, items });
}
