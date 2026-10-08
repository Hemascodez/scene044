import { NextResponse } from 'next/server';
import { getHostVenueSlug, HOST_ACCESS_MESSAGE } from '@/lib/venueHostAccess';
import { getCatalogVenue } from '@/lib/venueCatalog';
import { parseHostSpaceDetails } from '@/lib/venueHostSpaceValidation';
import { canUseHostPhotos } from '@/lib/venueHostPhotos';
import { saveHostSpace } from '@/lib/venueHostChanges';

export async function POST(request: Request) {
  try {
    const slug = await getHostVenueSlug(request);
    if (!slug) return NextResponse.json({ error: HOST_ACCESS_MESSAGE }, { status: 403 });
    const body = await request.json().catch(() => null);
    const details = parseHostSpaceDetails(body);
    if (typeof details === 'string') return NextResponse.json({ error: details }, { status: 400 });
    if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) return NextResponse.json({ error: 'Invalid request. Reopen the new-space form.' }, { status: 400 });
    const venue = await getCatalogVenue(slug);
    if (!venue) return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
    if (!await canUseHostPhotos(venue, details.photos)) return NextResponse.json({ error: 'Use photos uploaded for your venue.' }, { status: 400 });
    const id = await saveHostSpace(request, slug, details, body.requestId);
    const space = (await getCatalogVenue(slug))?.spaces.find(room => room.rowId === id);
    return NextResponse.json({ ok: true, space }, { status: 201 });
  } catch (error) {
    console.error('[host venue] create space failed', error);
    return NextResponse.json({ error: 'Could not publish the space. Please retry.' }, { status: 503 });
  }
}
