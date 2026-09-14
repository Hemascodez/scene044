import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { listPartnerRequests, type PartnerRequestStatus } from "@/lib/venueCatalog";

const STATUSES: PartnerRequestStatus[] = ["new", "contacted", "onboarding", "listed", "declined"];

export async function GET(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  if (statusParam && !STATUSES.includes(statusParam as PartnerRequestStatus)) {
    return NextResponse.json({ error: "unknown status", allowed: STATUSES }, { status: 400 });
  }
  try {
    const requests = await listPartnerRequests(statusParam as PartnerRequestStatus | undefined);
    return NextResponse.json({ ok: true, requests });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
