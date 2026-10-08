import { NextResponse } from 'next/server';
import { getHostVenueSlug, HOST_ACCESS_MESSAGE } from '@/lib/venueHostAccess';
import { getCatalogVenue, updateVenueSpaceImage } from '@/lib/venueCatalog';
import { canUseHostPhotos } from '@/lib/venueHostPhotos';

export async function PATCH(request: Request, { params }: { params: Promise<{ rowId: string }> }) {
  try {
    const slug = await getHostVenueSlug(request);
    if (!slug) return NextResponse.json({ error: HOST_ACCESS_MESSAGE }, { status: 403 });
    const { rowId } = await params;
    const id = Number(rowId);
    if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) return NextResponse.json({ error: 'Invalid room.' }, { status: 400 });
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
    const image = body && typeof body === 'object' ? (body as { image?: unknown }).image : undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'image') ||
        typeof image !== 'string' || !image.trim() || image.length > 2048) {
      return NextResponse.json({ error: 'Only the room photo can be changed here.' }, { status: 400 });
    }
    const venue = await getCatalogVenue(slug);
    if (!venue?.spaces.some(space => space.rowId === id)) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    if (!await canUseHostPhotos(venue, [image.trim()])) return NextResponse.json({ error: 'Use a photo uploaded for your venue.' }, { status: 400 });
    const space = await updateVenueSpaceImage(slug, id, image.trim());
    return space ? NextResponse.json({ ok: true, space })
      : NextResponse.json({ error: 'Room not found.' }, { status: 404 });
  } catch (error) {
    console.error('[host venue] room photo failed', error);
    return NextResponse.json({ error: 'Could not save the room photo. Please retry.' }, { status: 503 });
  }
}
