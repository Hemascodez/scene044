import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";

/**
 * Parks a half-finished draft on the item as `needs_correction`.
 *
 * Stored server-side rather than in the curator's browser: the queue is shared,
 * so a draft trapped in one person's localStorage is work nobody else can pick up.
 */
export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { discoveryItemId?: number; draft?: unknown; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const discoveryItemId = Number(body.discoveryItemId);
  if (!Number.isInteger(discoveryItemId) || discoveryItemId <= 0) {
    return NextResponse.json({ error: "invalid discoveryItemId" }, { status: 400 });
  }
  if (!body.draft || typeof body.draft !== "object") {
    return NextResponse.json({ error: "draft is required" }, { status: 400 });
  }

  try {
    const { rows } = await query<{ id: number }>(
      `UPDATE discovery_items
         SET curator_draft = $1::jsonb,
             status = 'needs_correction',
             rejection_reason = $2
       WHERE id = $3 AND status IN ('curator_pending', 'needs_correction')
       RETURNING id`,
      [JSON.stringify(body.draft), (body.note ?? "").slice(0, 500) || null, discoveryItemId],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "not found or not open for review" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, status: "needs_correction" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
