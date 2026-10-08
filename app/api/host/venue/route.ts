import { NextResponse } from 'next/server';
import { getHostVenueSlug, HOST_ACCESS_MESSAGE } from '@/lib/venueHostAccess';
import { getCatalogVenue } from '@/lib/venueCatalog';
import { saveHostPhotos } from '@/lib/venueHostChanges';
import { canUseHostPhotos, MAX_VENUE_PHOTOS, parseHostPhotos } from '@/lib/venueHostPhotos';

const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  try {
    const slug = await getHostVenueSlug(request);
    if (!slug) return NextResponse.json({ error: HOST_ACCESS_MESSAGE }, { status: 403, headers });
    const venue = await getCatalogVenue(slug);
    return venue ? NextResponse.json({ ok: true, venue }, { headers })
      : NextResponse.json({ error: 'Your venue could not be found. Contact SCENE/044.' }, { status: 404, headers });
  } catch (error) {
    console.error('[host venue] load failed', error);
    return NextResponse.json({ error: 'Could not load your venue. Please retry.' }, { status: 503, headers });
  }
}

export async function PATCH(request: Request) {
  try {
    const slug = await getHostVenueSlug(request);
    if (!slug) return NextResponse.json({ error: HOST_ACCESS_MESSAGE }, { status: 403, headers });
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers }); }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => key !== 'photos')) {
      return NextResponse.json({ error: 'Only venue photos can be changed here.' }, { status: 400, headers });
    }
    const photos = parseHostPhotos((body as { photos?: unknown }).photos);
    if (!photos) return NextResponse.json({ error: `Choose up to ${MAX_VENUE_PHOTOS} unique photos.` }, { status: 400, headers });
    const venue = await getCatalogVenue(slug);
    if (!venue) return NextResponse.json({ error: 'Venue not found.' }, { status: 404, headers });
    if (!await canUseHostPhotos(venue, photos)) {
      return NextResponse.json({ error: 'Use photos uploaded for your venue.' }, { status: 400, headers });
    }
    const saved = await saveHostPhotos(request, slug, photos) ? await getCatalogVenue(slug) : null;
    return saved ? NextResponse.json({ ok: true, venue: saved }, { headers })
      : NextResponse.json({ error: 'Venue not found.' }, { status: 404, headers });
  } catch (error) {
    console.error('[host venue] save failed', error);
    return NextResponse.json({ error: 'Could not save your photos. Please retry.' }, { status: 503, headers });
  }
}
