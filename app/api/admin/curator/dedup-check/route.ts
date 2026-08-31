import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";
import {
  findDuplicateEvent,
  DEDUP_HIGH_CONFIDENCE_THRESHOLD,
  DEDUP_LOW_CONFIDENCE_THRESHOLD,
} from "@/lib/dedup";
import { CATEGORIES, type Category } from "@/lib/types";

/**
 * Runs the same dedup pass `approve` will run, but read-only, so the curator
 * sees the match and decides *before* publishing rather than discovering after
 * the fact that their event silently merged into another one.
 */
export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    title?: string;
    startAt?: string | null;
    isOnline?: boolean;
    venueName?: string | null;
    organizerName?: string | null;
    category?: string;
    url?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!(CATEGORIES as readonly string[]).includes(body.category ?? "")) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  try {
    const match = await findDuplicateEvent({
      title: body.title,
      startAt: body.startAt ?? null,
      isOnline: !!body.isOnline,
      venueName: body.venueName ?? null,
      organizerName: body.organizerName ?? null,
      category: body.category as Category,
      url: body.url ?? "",
    });

    if (!match) {
      return NextResponse.json({ ok: true, outcome: "none", score: 0, match: null });
    }

    // Enrich with the fields the review panel displays — findDuplicateEvent
    // returns only an id and a score.
    const { rows } = await query<{
      id: number;
      title: string;
      start_at: string | null;
      venue_name: string | null;
      is_online: boolean;
      organizer_name: string | null;
      primary_source_url: string;
      status: string;
    }>(
      `SELECT id, title, start_at, venue_name, is_online, organizer_name, primary_source_url, status
       FROM events WHERE id = $1`,
      [match.eventId],
    );

    const outcome =
      match.score >= DEDUP_HIGH_CONFIDENCE_THRESHOLD
        ? "high"
        : match.score >= DEDUP_LOW_CONFIDENCE_THRESHOLD
          ? "medium"
          : "low";

    return NextResponse.json({
      ok: true,
      outcome,
      score: match.score,
      matchedOn: match.matchedOn,
      match: rows[0] ?? null,
      thresholds: {
        high: DEDUP_HIGH_CONFIDENCE_THRESHOLD,
        low: DEDUP_LOW_CONFIDENCE_THRESHOLD,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
