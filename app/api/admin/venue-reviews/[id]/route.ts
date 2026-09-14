import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { setReviewStatus } from "@/lib/venueBookings";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (body.status !== "published" && body.status !== "rejected") {
    return NextResponse.json({ error: "status must be 'published' or 'rejected'" }, { status: 400 });
  }

  try {
    const updated = await setReviewStatus(id, body.status);
    if (!updated) return NextResponse.json({ error: "not found, or already decided" }, { status: 404 });
    return NextResponse.json({ ok: true, review: updated });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
