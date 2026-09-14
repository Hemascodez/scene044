import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { setPartnerRequestStatus, type PartnerRequestStatus } from "@/lib/venueCatalog";

const STATUSES: PartnerRequestStatus[] = ["new", "contacted", "onboarding", "listed", "declined"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  let body: { status?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!STATUSES.includes(body.status as PartnerRequestStatus)) {
    return NextResponse.json({ error: "unknown status", allowed: STATUSES }, { status: 400 });
  }

  try {
    const updated = await setPartnerRequestStatus(
      id,
      body.status as PartnerRequestStatus,
      typeof body.note === "string" ? body.note.trim() : null,
    );
    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, request: updated });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
