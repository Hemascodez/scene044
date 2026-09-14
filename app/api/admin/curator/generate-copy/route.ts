import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { summarizeEvent } from "@/lib/summarize";
import { CATEGORIES, type Category, type PriceType } from "@/lib/types";

/**
 * "Ask AI to draft this" for a curator-entered event.
 *
 * An event a curator types in by hand skips the pipeline's editorial pass
 * entirely, so it never got a summary, a gist, or highlights — the "At a
 * glance" block would be nearly empty for every manually-added event. This
 * runs the exact same lib/summarize.ts pass the pipeline uses on everything
 * else, fed with whatever facts the curator has already entered plus whatever
 * source text they paste in (the organizer's own description, if they have
 * one), so a curator-added event gets the same honesty guarantees — nothing
 * invented, null when the evidence is insufficient — rather than a separate,
 * looser code path.
 */

interface GenerateCopyBody {
  title?: unknown;
  category?: unknown;
  organizerName?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  isOnline?: unknown;
  venueName?: unknown;
  venueAddress?: unknown;
  priceType?: unknown;
  priceNote?: unknown;
  /** Whatever the curator has to go on — pasted organizer copy, a snippet,
   *  or their own notes. This is the only required field: with nothing to
   *  ground it, the model has nothing to compress and sharpen. */
  sourceText?: unknown;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: GenerateCopyBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const title = str(body.title);
  const sourceText = str(body.sourceText);
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!sourceText) {
    return NextResponse.json(
      { error: "Paste some source text first — the organizer's own description, a snippet, anything to ground it in." },
      { status: 400 },
    );
  }

  const category = str(body.category);
  if (category && !(CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }
  const priceType = str(body.priceType);
  if (priceType && priceType !== "free" && priceType !== "paid") {
    return NextResponse.json({ error: "priceType must be 'free' or 'paid'" }, { status: 400 });
  }

  try {
    const result = await summarizeEvent({
      title,
      rawSummary: sourceText,
      category: category as Category | undefined,
      organizerName: str(body.organizerName),
      startAt: str(body.startAt),
      endAt: str(body.endAt),
      isOnline: typeof body.isOnline === "boolean" ? body.isOnline : undefined,
      venueName: str(body.venueName),
      venueAddress: str(body.venueAddress),
      priceType: priceType as PriceType | undefined,
      priceNote: str(body.priceNote),
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
