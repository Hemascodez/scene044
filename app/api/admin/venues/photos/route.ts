import { NextResponse } from 'next/server';
import { checkCuratorAccess } from '@/lib/auth';
import { storePosterBytes } from '@/lib/posterStore';
import { MAX_VENUE_PHOTO_BYTES, MAX_VENUE_UPLOAD_BODY_BYTES } from '@/lib/venuePhotoLimits';

/** Venue-only uploader; event posters keep their separate 5 MB limit. */
export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Upload a JPG, PNG or WebP file.' }, { status: 415 });
  }
  if (Number(request.headers.get('content-length')) > MAX_VENUE_UPLOAD_BODY_BYTES) {
    return NextResponse.json({ error: 'Photo is too large. Maximum is 10 MB.' }, { status: 413 });
  }

  try {
    let form: FormData;
    try { form = await request.formData(); }
    catch { return NextResponse.json({ error: 'Could not read this photo. Use a JPG, PNG or WebP image under 10 MB and retry.' }, { status: 400 }); }
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file was included.' }, { status: 400 });
    if (file.size > MAX_VENUE_PHOTO_BYTES) {
      return NextResponse.json({ error: 'Photo is too large. Maximum is 10 MB.' }, { status: 413 });
    }
    const result = await storePosterBytes(Buffer.from(await file.arrayBuffer()), 'upload', null, MAX_VENUE_PHOTO_BYTES);
    return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: 400 });
  } catch (error) {
    console.error('[curator venue] upload failed', error);
    return NextResponse.json({ error: 'Photo upload failed. Please retry.' }, { status: 503 });
  }
}
