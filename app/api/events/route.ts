import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPublicEvents, parseCategoryParam } from "@/lib/events";

export async function GET(request: NextRequest) {
  try {
    const category = parseCategoryParam(request.nextUrl.searchParams.get("category"));
    const events = await getPublicEvents(category ? [category] : null);
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 500) }, { status: 500 });
  }
}
