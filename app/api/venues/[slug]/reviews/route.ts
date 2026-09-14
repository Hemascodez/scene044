import { NextResponse } from "next/server";
import { getCatalogVenue } from "@/lib/venueCatalog";
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
}

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const venue = await getCatalogVenue(slug);
  if (!venue || venue.status === "hidden") {
    return NextResponse.json({ error: "venue not found" }, { status: 404 });
  }

  let body: SelfReviewBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

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
