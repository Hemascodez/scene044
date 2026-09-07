import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";
import { normalizeUrl } from "@/lib/domain";
import { findDuplicateEvent, DEDUP_HIGH_CONFIDENCE_THRESHOLD } from "@/lib/dedup";
import { CATEGORIES, type Category, type EventStatus, type PriceType } from "@/lib/types";

/** Lifecycle states a curator may publish into. `expired` is excluded — there
 *  is no reason to publish something already over. */
const PUBLISHABLE_STATUSES: EventStatus[] = ["live", "postponed", "cancelled", "expired"];

/** Items open for review. `needs_correction` is included so a parked draft can
 *  be finished and published without being reopened first. */
const REVIEWABLE_ITEM_STATUSES = ["curator_pending", "needs_correction"];

interface ApproveBody {
  discoveryItemId: number;
  title: string;
  summary: string | null;
  category: Category;
  startAt: string | null;
  endAt: string | null;
  isOnline: boolean;
  venueName: string | null;
  venueAddress: string | null;
  organizerName: string | null;
  posterImageUrl: string | null;
  priceType?: PriceType | null;
  priceNote?: string | null;
  chennaiRelevanceScore: number;
  /** Optional lifecycle override; defaults to `live`. */
  status?: EventStatus;
  /** Optional outbound destination override (a registration page that differs
   *  from the page the candidate was discovered on). Defaults to the item URL. */
  primarySourceUrl?: string | null;
}

/** Only absolute http(s) URLs are storable — anything else could produce a
 *  `javascript:` or `data:` destination on a public "View event" link. */
/** Absolute http(s) URL, unchanged. Reused for primarySourceUrl, which is
 *  always an external link and never one of ours. */
function safeHttpUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A poster is either a full external URL, or one of ours — `/api/poster/<id>`,
 * which is what lib/posterStore.ts hands back from every curator upload.
 *
 * `new URL("/api/poster/7")` with no base throws: it has no scheme to parse,
 * so safeHttpUrl alone rejected every self-hosted poster as invalid, even
 * though it is exactly the correct, expected shape. This was blocking
 * publishing on every curator-uploaded poster with a misleading error.
 */
function safePosterUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/^\/api\/poster\/\d+$/.test(raw)) return raw;
  return safeHttpUrl(raw);
}

export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: ApproveBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const discoveryItemId = Number(body.discoveryItemId);
  if (!Number.isInteger(discoveryItemId) || discoveryItemId <= 0) {
    return NextResponse.json({ error: "invalid discoveryItemId" }, { status: 400 });
  }
  if (!(CATEGORIES as readonly string[]).includes(body.category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const eventStatus: EventStatus = body.status ?? "live";
  if (!PUBLISHABLE_STATUSES.includes(eventStatus)) {
    return NextResponse.json(
      { error: "invalid status", allowed: PUBLISHABLE_STATUSES },
      { status: 400 },
    );
  }
  if (body.primarySourceUrl && !safeHttpUrl(body.primarySourceUrl)) {
    return NextResponse.json({ error: "primarySourceUrl must be an http(s) URL" }, { status: 400 });
  }
  if (body.posterImageUrl && !safePosterUrl(body.posterImageUrl)) {
    return NextResponse.json(
      { error: "posterImageUrl must be an http(s) URL or /api/poster/<id>" },
      { status: 400 },
    );
  }
  if (body.priceType != null && body.priceType !== "free" && body.priceType !== "paid") {
    return NextResponse.json({ error: "priceType must be 'free', 'paid' or null" }, { status: 400 });
  }

  try {
    const { rows } = await query<{ id: number; url: string; source_domain: string; status: string }>(
      "SELECT id, url, source_domain, status FROM discovery_items WHERE id = $1",
      [discoveryItemId],
    );
    const item = rows[0];
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!REVIEWABLE_ITEM_STATUSES.includes(item.status)) {
      return NextResponse.json(
        { error: "not open for curator review", status: item.status },
        { status: 409 },
      );
    }

    // The curator can point "View event" at a registration page that differs
    // from where the candidate was found; the discovery URL is still recorded
    // in event_sources below either way.
    const destinationUrl = safeHttpUrl(body.primarySourceUrl) ?? item.url;

    const relevance = Math.min(1, Math.max(0, Number(body.chennaiRelevanceScore) || 0));

    // A human already vetted this specific item — only a HIGH-confidence dedup
    // match short-circuits to a merge. Anything below that creates a new event
    // rather than bouncing back into curator review a second time.
    const dup = await findDuplicateEvent({
      title: body.title,
      startAt: body.startAt ?? null,
      isOnline: !!body.isOnline,
      venueName: body.venueName ?? null,
      organizerName: body.organizerName ?? null,
      category: body.category,
      url: item.url,
    });

    if (dup && dup.score >= DEDUP_HIGH_CONFIDENCE_THRESHOLD) {
      await query(
        `INSERT INTO event_sources (event_id, source_url, source_domain, discovery_item_id)
         VALUES ($1,$2,$3,$4) ON CONFLICT (event_id, source_url) DO NOTHING`,
        [dup.eventId, normalizeUrl(item.url), item.source_domain, item.id],
      );
      await query(
        "UPDATE discovery_items SET status = 'duplicate', event_id = $1, curator_draft = NULL WHERE id = $2",
        [dup.eventId, item.id],
      );
      return NextResponse.json({ ok: true, status: "duplicate", eventId: dup.eventId });
    }

    const {
      rows: [eventRow],
    } = await query<{ id: number }>(
      `INSERT INTO events (title, summary, category, start_at, end_at, is_online, venue_name, venue_address, organizer_name, poster_image_url, price_type, price_note, primary_source_url, source_type, chennai_relevance_score, status, last_verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'curator',$14,$15, now()) RETURNING id`,
      [
        body.title.trim(),
        body.summary ?? null,
        body.category,
        body.startAt ?? null,
        body.endAt ?? null,
        !!body.isOnline,
        body.venueName ?? null,
        body.venueAddress ?? null,
        body.organizerName ?? null,
        body.posterImageUrl ?? null,
        body.priceType ?? null,
        (body.priceNote ?? "").trim() || null,
        normalizeUrl(destinationUrl),
        relevance,
        eventStatus,
      ],
    );

    await query(
      `INSERT INTO event_sources (event_id, source_url, source_domain, discovery_item_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT (event_id, source_url) DO NOTHING`,
      [eventRow.id, normalizeUrl(item.url), item.source_domain, item.id],
    );
    await query(
      "UPDATE discovery_items SET status = 'curator_approved', event_id = $1, curator_draft = NULL WHERE id = $2",
      [eventRow.id, item.id],
    );

    return NextResponse.json({ ok: true, status: "created", eventId: eventRow.id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
