import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { discoveryItemId: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const discoveryItemId = Number(body.discoveryItemId);
  if (!Number.isInteger(discoveryItemId) || discoveryItemId <= 0) {
    return NextResponse.json({ error: "invalid discoveryItemId" }, { status: 400 });
  }

  try {
    const { rows } = await query<{ id: number }>(
      "UPDATE discovery_items SET status = 'curator_rejected', rejection_reason = $1 WHERE id = $2 AND status = 'curator_pending' RETURNING id",
      [(body.reason || "curator_rejected").slice(0, 500), discoveryItemId],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "not found or not pending curator review" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, status: "curator_rejected" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
