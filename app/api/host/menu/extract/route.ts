import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { detectImageMime, MAX_POSTER_BYTES } from '@/lib/imageBytes';
import { extractVenueMenu } from '@/lib/venueMenuExtract';
export const maxDuration = 120;
export async function POST(request: Request) {
  if (!await checkCuratorAccess(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (Number(request.headers.get('content-length')) > MAX_POSTER_BYTES + 100000) return NextResponse.json({ error: 'Photo must be under 5 MB' }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const photo = form?.get('photo');
  if (!(photo instanceof File) || !photo.size || photo.size > MAX_POSTER_BYTES) return NextResponse.json({ error: 'Upload a JPG, PNG or WebP photo under 5 MB' }, { status: 400 });
  const bytes = Buffer.from(await photo.arrayBuffer());
  const mime = detectImageMime(bytes);
  if (!mime) return NextResponse.json({ error: 'Use a JPG, PNG or WebP photo' }, { status: 400 });
  try { return NextResponse.json(await extractVenueMenu(bytes, mime)); }
  catch { return NextResponse.json({ error: 'Could not extract this menu. Try a clearer photo or enter items manually.' }, { status: 502 }); }
}
