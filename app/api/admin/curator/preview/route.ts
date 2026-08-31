import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";
import { extractEventFromUrl, validateExtractedEvent } from "@/lib/extract";
import { categorizeEvent } from "@/lib/categorize";

function isLinkedIn(domain: string): boolean {
  return domain === "linkedin.com" || domain.endsWith(".linkedin.com");
}

export async function GET(request: NextRequest) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const idParam = request.nextUrl.searchParams.get("id");
  const discoveryItemId = Number(idParam);
  if (!Number.isInteger(discoveryItemId) || discoveryItemId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  try {
    const { rows } = await query<{ id: number; url: string; source_domain: string; status: string }>(
      "SELECT id, url, source_domain, status FROM discovery_items WHERE id = $1",
      [discoveryItemId],
    );
    const item = rows[0];
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    // `needs_correction` included so re-running extraction on a parked draft
    // doesn't require reopening the item first.
    if (item.status !== "curator_pending" && item.status !== "needs_correction") {
      return NextResponse.json(
        { error: "not open for curator review", status: item.status },
        { status: 409 },
      );
    }

    // LinkedIn is never fetched server-side, even for a curator-initiated preview —
    // the curator opens it themselves; this just returns the existing search metadata.
    if (isLinkedIn(item.source_domain)) {
      return NextResponse.json({
        ok: true,
        discoveryItemId,
        skippedFetch: true,
        reason: "linkedin_never_fetched",
        extracted: null,
        categorization: null,
      });
    }

    // Scoped to exactly this item's own domain — a curator-initiated single-URL
    // preview isn't bulk automated crawling, so the auto_fetch allowlist tier
    // doesn't apply, but SSRF protections (private IPs, off-domain redirects,
    // size/content-type limits) still do.
    const extracted = await extractEventFromUrl(item.url, [item.source_domain]);
    if (!extracted) {
      return NextResponse.json({ ok: true, discoveryItemId, extracted: null, categorization: null });
    }

    const validation = validateExtractedEvent(extracted);
    const categorization = await categorizeEvent({
      title: extracted.title,
      summary: extracted.summary,
      venueAddress: extracted.venueAddress,
      isOnline: extracted.isOnline,
    });

    return NextResponse.json({
      ok: true,
      discoveryItemId,
      extracted,
      categorization,
      validation,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
