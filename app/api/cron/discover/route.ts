import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/auth";
import { MissingSearchCredentialsError } from "@/lib/search";
import { runDiscovery } from "@/lib/pipeline";

/**
 * Manual trigger for a discovery run.
 *
 * The production path is the scheduled container in scripts/run-pipeline.ts —
 * a full sweep takes ~98s, which exceeds the function timeout on most hosts.
 * Both call the same lib/pipeline.ts code so they can't drift.
 */
export async function GET(request: Request) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const limitParam = Number(params.get("limit"));

  try {
    const result = await runDiscovery({
      limit: Number.isInteger(limitParam) && limitParam > 0 ? limitParam : undefined,
      site: params.get("site") ?? undefined,
    });
    return NextResponse.json({ ok: true, ...result, creditsUsed: result.creditsUsed || undefined });
  } catch (err) {
    if (err instanceof MissingSearchCredentialsError) {
      return NextResponse.json({ ok: false, error: err.message, setupRequired: true }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
