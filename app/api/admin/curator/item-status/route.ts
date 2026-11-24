import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";
import type { DiscoveryItemStatus } from "@/lib/types";

/** Quick triage from the queue list, without opening full review. */
const ALLOWED: Record<string, { status: DiscoveryItemStatus; defaultReason: string }> = {
  irrelevant: { status: "curator_rejected", defaultReason: "Not relevant" },
  expired: { status: "expired", defaultReason: "Event has already happened" },
  needs_date_review: { status: "needs_date_review", defaultReason: "No reliable event date found" },
  rejected: { status: "curator_rejected", defaultReason: "Rejected by curator" },
  reopen: { status: "curator_pending", defaultReason: "" },
};

export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { discoveryItemId?: number; action?: string; reason?: string; expectedStatus?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const discoveryItemId = Number(body.discoveryItemId);
  if (!Number.isInteger(discoveryItemId) || discoveryItemId <= 0) {
    return NextResponse.json({ error: "invalid discoveryItemId" }, { status: 400 });
  }
  const mapped = ALLOWED[body.action ?? ""];
  if (!mapped) {
    return NextResponse.json({ error: "invalid action", allowed: Object.keys(ALLOWED) }, { status: 400 });
  }
  if (body.expectedStatus != null && !['new', 'auto_processing'].includes(body.expectedStatus)) {
    return NextResponse.json({ error: 'invalid expectedStatus' }, { status: 400 });
  }

  try {
    // Never reaches back into an item already turned into a live event —
    // that would silently orphan the published card.
    const { rows } = await query<{ id: number }>(
      `UPDATE discovery_items SET status = $1, rejection_reason = $2
       WHERE id = $3 AND status NOT IN ('curator_approved', 'duplicate') AND event_id IS NULL
         AND ($4::text IS NULL OR status = $4::text)
       RETURNING id`,
      [
        mapped.status,
        ((body.reason ?? "").slice(0, 500) || mapped.defaultReason) || null,
        discoveryItemId,
        body.expectedStatus ?? null,
      ],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "not found, changed or already published" }, { status: body.expectedStatus ? 409 : 404 });
    }
    return NextResponse.json({ ok: true, status: mapped.status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
