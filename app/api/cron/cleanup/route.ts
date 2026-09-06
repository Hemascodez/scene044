import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/auth";
import { runCleanup } from "@/lib/pipeline";

/**
 * Weekly housekeeping — expires events whose date has passed, clears queue
 * items too old to still be upcoming, and drops orphaned poster bytes.
 *
 * Nothing is deleted except unreferenced images: expired rows stay for
 * auditing and for a "what you missed" surface later.
 */
export async function GET(request: Request) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runCleanup()) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
