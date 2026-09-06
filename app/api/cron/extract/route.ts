import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/auth";
import { runExtraction } from "@/lib/pipeline";

/** Manual trigger for one extraction batch. See app/api/cron/discover/route.ts
 *  for why the production path is a scheduled container instead. */
export async function GET(request: Request) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runExtraction();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
