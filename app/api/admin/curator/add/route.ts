import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { checkCuratorAccess } from "@/lib/auth";
import { normalizeDomain, normalizeUrl } from "@/lib/domain";

/**
 * Creates a curator-originated discovery item from a pasted URL.
 *
 * Nothing is fetched here — the curator opens the page themselves. This only
 * records the candidate so it flows through the same review, dedup and audit
 * path as a search-discovered one.
 */
export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const raw = (body.url ?? "").trim();
  if (!raw) return NextResponse.json({ error: "url is required" }, { status: 400 });

  // Reject a non-http scheme outright rather than prefixing it. Blindly
  // prepending "https://" to anything without an http(s) prefix turns
  // "file:///etc/passwd" into the parseable "https://file//etc/passwd", which
  // then passes a protocol check — the scheme has to be inspected first.
  const explicitScheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw)?.[1]?.toLowerCase();
  if (explicitScheme && explicitScheme !== "http" && explicitScheme !== "https") {
    return NextResponse.json(
      { error: `unsupported URL scheme "${explicitScheme}" — only http(s) is allowed` },
      { status: 400 },
    );
  }

  const withScheme = explicitScheme ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return NextResponse.json({ error: "not a valid URL" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "only http(s) URLs are allowed" }, { status: 400 });
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return NextResponse.json({ error: "URL must have a real hostname" }, { status: 400 });
  }

  const url = normalizeUrl(withScheme);
  const domain = normalizeDomain(withScheme);

  try {
    // url is UNIQUE — reuse an existing candidate instead of erroring, so
    // pasting a URL already in the queue just reopens it.
    const { rows: existing } = await query<{ id: number; status: string }>(
      "SELECT id, status FROM discovery_items WHERE url = $1",
      [url],
    );
    if (existing[0]) {
      return NextResponse.json({
        ok: true,
        reused: true,
        discoveryItemId: existing[0].id,
        status: existing[0].status,
      });
    }

    const {
      rows: [created],
    } = await query<{ id: number }>(
      `INSERT INTO discovery_items (title, snippet, url, source_domain, status, origin)
       VALUES ($1, $2, $3, $4, 'curator_pending', 'curator')
       RETURNING id`,
      [
        `Curator-added — ${domain}`,
        "Manually added by a curator. Open the source and fill in the details.",
        url,
        domain,
      ],
    );

    return NextResponse.json({ ok: true, reused: false, discoveryItemId: created.id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
