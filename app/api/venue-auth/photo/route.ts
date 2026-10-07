import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getVenueUserFromRequest } from '@/lib/venueUserAuth';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const MAX_BYTES = 512 * 1024;

export async function GET(request: Request) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401, headers });
  const { rows } = await query<{ bytes: Buffer }>('SELECT bytes FROM venue_user_photos WHERE user_id = $1', [user.id]);
  if (!rows[0]) return new Response(null, { status: 404, headers });
  return new Response(new Uint8Array(rows[0].bytes), { headers: { ...headers, 'Content-Type': 'image/jpeg' } });
}

export async function POST(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Use your SCENE profile to upload a photo.' }, { status: 403, headers });
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401, headers });
  const size = Number(request.headers.get('content-length'));
  if (size > MAX_BYTES + 8192) return NextResponse.json({ error: 'Choose a smaller photo and try again.' }, { status: 413, headers });
  let form: FormData;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Missing body');
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES + 8192) {
        await reader.cancel();
        return NextResponse.json({ error: 'Choose a smaller photo and try again.' }, { status: 413, headers });
      }
      chunks.push(value);
    }
    form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData();
  }
  catch { return NextResponse.json({ error: 'Invalid photo upload.' }, { status: 400, headers }); }
  const file = form.get('photo');
  if (file instanceof File && file.size > MAX_BYTES) return NextResponse.json({ error: 'Choose a smaller photo and try again.' }, { status: 413, headers });
  if (!(file instanceof File) || file.type !== 'image/jpeg' || file.size < 4) {
    return NextResponse.json({ error: 'Upload a JPEG photo under 512 KB.' }, { status: 400, headers });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    return NextResponse.json({ error: 'Invalid JPEG photo.' }, { status: 400, headers });
  }
  await query(`INSERT INTO venue_user_photos (user_id, bytes) VALUES ($1,$2)
    ON CONFLICT (user_id) DO UPDATE SET bytes = EXCLUDED.bytes, updated_at = now()`, [user.id, bytes]);
  return NextResponse.json({ ok: true }, { headers });
}

export async function DELETE(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Use your SCENE profile to remove a photo.' }, { status: 403, headers });
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401, headers });
  await query('DELETE FROM venue_user_photos WHERE user_id = $1', [user.id]);
  return NextResponse.json({ ok: true }, { headers });
}
