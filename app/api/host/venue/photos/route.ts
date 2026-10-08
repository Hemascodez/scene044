import { NextResponse } from 'next/server';
import { getHostVenueSlug, HOST_ACCESS_MESSAGE } from '@/lib/venueHostAccess';
import { getCatalogVenue } from '@/lib/venueCatalog';
import { MAX_POSTER_BYTES } from '@/lib/imageBytes';
import { storePosterBytes } from '@/lib/posterStore';
import { hostPhotoOrigin } from '@/lib/venueHostPhotos';

export async function POST(request: Request) {
  try {
    const slug = await getHostVenueSlug(request);
    if (!slug) return NextResponse.json({ error: HOST_ACCESS_MESSAGE }, { status: 403 });
    if (!await getCatalogVenue(slug)) return NextResponse.json({ error: 'Venue not found.' }, { status: 404 });
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Upload a JPG, PNG or WebP file.' }, { status: 415 });
    }
    if (Number(request.headers.get('content-length')) > MAX_POSTER_BYTES + 65536) {
      return NextResponse.json({ error: 'Photo is too large. Maximum is 5 MB.' }, { status: 413 });
    }
    let form: FormData;
    try { form = await request.formData(); }
    catch { return NextResponse.json({ error: 'Could not read the uploaded file.' }, { status: 400 }); }
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file was included.' }, { status: 400 });
    if (file.size > MAX_POSTER_BYTES) return NextResponse.json({ error: 'Photo is too large. Maximum is 5 MB.' }, { status: 413 });
    const result = await storePosterBytes(Buffer.from(await file.arrayBuffer()), 'upload', hostPhotoOrigin(slug));
    return result.ok ? NextResponse.json(result)
      : NextResponse.json({ error: result.error }, { status: 400 });
  } catch (error) {
    console.error('[host venue] upload failed', error);
    return NextResponse.json({ error: 'Could not upload your photo. Please retry.' }, { status: 503 });
  }
}
