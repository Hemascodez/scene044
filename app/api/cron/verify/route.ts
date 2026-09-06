import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/auth";
import { runVerification } from "@/lib/pipeline";

/**
 * Manual trigger for a freshness pass — expires past-dated events and
 * re-checks that live events' source pages still exist.
 *
 * This route existed in the deploy schedule but not on disk, which meant the
 * footer's "Freshness-checked continuously" claim was unbacked. The production
 * path is the scheduled container (scripts/run-pipeline.ts).
 */
export async function GET(request: Request) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runVerification();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
