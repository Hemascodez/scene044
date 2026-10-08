import { NextResponse } from "next/server";
import { getCatalogVenue } from "@/lib/venueCatalog";
import { getVenueUserFromRequest } from '@/lib/venueUserAuth';
import { detectImageMime, MAX_POSTER_BYTES } from '@/lib/imageBytes';
import { pool } from '@/lib/db';
import {
  REVIEW_TAGS,
  aspectScores,
  createSelfReportedReview,
  listVenueReviews,
  summariseReviews,
  type ReviewTag,
} from "@/lib/venueBookings";

/**
 * Public review surface for a venue page: published reviews plus the
 * "already hosted here? add your review" submission target.
 *
 * Unlike the booking-gated path (lib/venueBookings.ts's createVenueReview),
 * anyone can post here — there is no SCENE booking to prove they were real.
 * That trust is recovered on the way out, not the way in: every submission
 * lands `pending` and is invisible to GET (which only ever reads `published`)
 * until a curator approves it.
 */

const MAX_NAME = 80;
const MAX_EVENT_TYPE = 80;
const MAX_COMMENT = 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const reviews = await listVenueReviews(slug);
    return NextResponse.json({
      ok: true,
      reviews,
      summary: summariseReviews(reviews),
      aspects: aspectScores(reviews),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}

interface SelfReviewBody {
  reviewerName?: unknown;
  eventType?: unknown;
  rating?: unknown;
  tags?: unknown;
  comment?: unknown;
  photoConsent?: unknown;
}

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Use the venue page to submit your review.' }, { status: 403 });

  const venue = await getCatalogVenue(slug);
  if (!venue || venue.status === "hidden") {
    return NextResponse.json({ error: "venue not found" }, { status: 404 });
  }

  let body: SelfReviewBody;
  const photos: Buffer[] = [];
  const multipart = request.headers.get('content-type')?.includes('multipart/form-data');
  try {
    if (multipart) {
      const user = await getVenueUserFromRequest(request);
      if (!user) return NextResponse.json({ error: 'Sign in before sharing your review and event photos.' }, { status: 401 });
      const limit = 6 * MAX_POSTER_BYTES + 65536;
      const reader = request.body?.getReader();
      if (!reader) return NextResponse.json({ error: 'Missing review.' }, { status: 400 });
      const chunks: Uint8Array[] = []; let length = 0;
      while (true) {
        const part = await reader.read(); if (part.done) break;
        length += part.value.byteLength;
        if (length > limit) { await reader.cancel(); return NextResponse.json({ error: 'Photos are too large. Each photo must be under 5 MB.' }, { status: 413 }); }
        chunks.push(part.value);
      }
      const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData();
      body = JSON.parse(String(form.get('review')));
      const files = form.getAll('photos');
      if (files.length < 1 || files.length > 6 || body.photoConsent !== true) return NextResponse.json({ error: 'Add 1–6 event photos and confirm permission to display them.' }, { status: 400 });
      for (const file of files) {
        if (!(file instanceof File) || file.size > MAX_POSTER_BYTES) return NextResponse.json({ error: 'Each photo must be a JPG, PNG or WebP under 5 MB.' }, { status: 400 });
        const bytes = Buffer.from(await file.arrayBuffer());
        if (!detectImageMime(bytes)) return NextResponse.json({ error: 'Choose JPG, PNG or WebP photos, not SVG.' }, { status: 400 });
        photos.push(bytes);
      }
    } else body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid review.' }, { status: 400 });
  const reviewerName = cleanString(body.reviewerName, MAX_NAME);
  if (!reviewerName) {
    return NextResponse.json({ error: "your name is required" }, { status: 400 });
  }

  // Emoji scale with no negative pole — the review flow only ever asks "how
  // good was it", not "how bad", so 3/4/5 is the whole range on purpose.
  const rating = Number(body.rating);
  if (![3, 4, 5].includes(rating)) {
    return NextResponse.json({ error: "rating must be 3, 4, or 5" }, { status: 400 });
  }

  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is ReviewTag => REVIEW_TAGS.includes(t)) : [];
  const comment = cleanString(body.comment, MAX_COMMENT);
  const eventType = cleanString(body.eventType, MAX_EVENT_TYPE);

  try {
    if (multipart) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const photoIds: number[] = [];
        for (const bytes of photos) {
          const image = await client.query<{ id: number }>('INSERT INTO poster_uploads(mime,bytes,byte_size,origin,origin_url) VALUES($1,$2,$3,$4,$5) RETURNING id', [detectImageMime(bytes), bytes, bytes.length, 'upload', `scene044:venue-review:${slug}`]);
          photoIds.push(image.rows[0].id);
        }
        const result = await client.query(`INSERT INTO venue_reviews(venue_slug,reviewer_name,event_type,rating,tags,comment,photo_ids,photo_consent,source,status)
          VALUES($1,$2,$3,$4,$5,$6,$7,true,'self_reported','pending') RETURNING id,status`, [slug,reviewerName,eventType,rating,tags,comment,photoIds]);
        await client.query('COMMIT');
        return NextResponse.json({ ok: true, review: result.rows[0] });
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
    const review = await createSelfReportedReview({
      venueSlug: slug,
      reviewerName,
      eventType,
      rating,
      tags,
      comment,
      photoIds: [],
      photoConsent: false,
    });
    return NextResponse.json({ ok: true, review });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
