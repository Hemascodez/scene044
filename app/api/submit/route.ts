import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { normalizeDomain, normalizeUrl } from "@/lib/domain";
import { CATEGORIES, type Category } from "@/lib/types";

/**
 * Community tip-off desk — the one public write endpoint in the app.
 *
 * Submissions never reach the feed directly. They land in `discovery_items` as
 * `curator_pending`, the same queue search-discovered candidates go through, so
 * a human still vets, extracts and dedups before anything is published. That
 * keeps the trust guarantees intact while letting people report what the
 * crawler missed.
 *
 * Note this reverses the original "no event submission" rule. That rule existed
 * to stop the feed becoming a self-promotion board; routing everything through
 * curation preserves the intent without closing the door on real tips.
 */

const MAX_TITLE = 200;
const MAX_NOTE = 1000;
const MAX_SUBMITTER = 200;

/** Crude global throttle. There's no per-IP store in a serverless runtime, and
 *  a public insert endpoint with no ceiling is an invitation. This caps the
 *  blast radius of a script without punishing normal use. */
const MAX_SUBMISSIONS_PER_HOUR = 30;

interface SubmitBody {
  kind?: unknown;
  title?: unknown;
  url?: unknown;
  categoryHint?: unknown;
  note?: unknown;
  submitter?: unknown;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let body: SubmitBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const kind = body.kind === "report" ? "report" : "submit";
  const title = text(body.title, MAX_TITLE);
  const rawUrl = text(body.url, 500);
  const note = text(body.note, MAX_NOTE);
  const submitter = text(body.submitter, MAX_SUBMITTER);

  if (title.length < 2) {
    return NextResponse.json({ error: "Give the event a name." }, { status: 400 });
  }
  if (!rawUrl) {
    return NextResponse.json({ error: "A link is required." }, { status: 400 });
  }

  // Same scheme handling as the curator's add endpoint: inspect an explicit
  // scheme before prefixing, or "file:///etc/passwd" becomes a parseable
  // "https://file//etc/passwd" and slips through a protocol check.
  const explicitScheme = /^([a-z][a-z0-9+.-]*):/i.exec(rawUrl)?.[1]?.toLowerCase();
  if (explicitScheme && explicitScheme !== "http" && explicitScheme !== "https") {
    return NextResponse.json({ error: "Only http(s) links are accepted." }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(explicitScheme ? rawUrl : `https://${rawUrl}`);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid link." }, { status: 400 });
  }
  if (!parsed.hostname.includes(".")) {
    return NextResponse.json({ error: "That link needs a real domain." }, { status: 400 });
  }

  const categoryHint =
    typeof body.categoryHint === "string" && (CATEGORIES as readonly string[]).includes(body.categoryHint)
      ? (body.categoryHint as Category)
      : null;

  const url = normalizeUrl(parsed.toString());
  const domain = normalizeDomain(parsed.toString());

  // Attribution is optional and free-text; it is stored as evidence for the
  // curator, never displayed publicly.
  const snippet =
    [
      note,
      submitter ? `— submitted by ${submitter}` : "",
      categoryHint ? `[suggested field: ${categoryHint}]` : "",
    ]
      .filter(Boolean)
      .join(" ") || "Community submission — no notes provided.";

  try {
    const { rows: recent } = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM discovery_items WHERE origin = 'community' AND discovered_at > now() - interval '1 hour'",
    );
    if (Number(recent[0]?.n ?? 0) >= MAX_SUBMISSIONS_PER_HOUR) {
      return NextResponse.json(
        { error: "The tip desk is busy right now — please try again shortly." },
        { status: 429 },
      );
    }

    const { rows: existing } = await query<{ id: number; status: string }>(
      "SELECT id, status FROM discovery_items WHERE url = $1",
      [url],
    );

    if (existing[0]) {
      // Already known. Record the note either way; only reopen for review if it
      // hasn't already become a published event.
      const reopenable = !["curator_approved", "duplicate"].includes(existing[0].status);
      await query(
        `UPDATE discovery_items
            SET snippet = COALESCE(snippet, '') || $1,
                status = CASE WHEN $2 THEN 'curator_pending' ELSE status END
          WHERE id = $3`,
        [`\n[${kind}] ${snippet}`, reopenable, existing[0].id],
      );
      return NextResponse.json({ ok: true, reused: true, queued: reopenable });
    }

    await query(
      `INSERT INTO discovery_items (title, snippet, url, source_domain, status, origin)
       VALUES ($1, $2, $3, $4, 'curator_pending', 'community')`,
      [title, `[${kind}] ${snippet}`, url, domain],
    );

    return NextResponse.json({ ok: true, reused: false, queued: true });
  } catch (err) {
    console.error("submit: failed", err);
    return NextResponse.json({ error: "Could not record that right now." }, { status: 500 });
  }
}
