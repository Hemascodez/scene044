import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { deleteVenueSpace } from "@/lib/venueCatalog";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; rowId: string }> },
) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { rowId } = await params;
  const id = Number(rowId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid room id" }, { status: 400 });
  }
  try {
    const deleted = await deleteVenueSpace(id);
    if (!deleted) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
