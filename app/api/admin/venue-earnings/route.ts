import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { venueEarnings } from "@/lib/venueCatalog";

/** ?venue=slug scopes to one venue; omitted totals across all of them. */
export async function GET(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const venueSlug = url.searchParams.get("venue") ?? undefined;
  try {
    const earnings = await venueEarnings(venueSlug);
    return NextResponse.json({ ok: true, earnings });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
