import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { createVenue, listAllVenues } from "@/lib/venueCatalog";

/** Curator's venue list — every venue regardless of status, unlike the public
 *  site which only shows live + coming-soon. */
export async function GET(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const venues = await listAllVenues();
    return NextResponse.json({ ok: true, venues });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Creates a new venue, always as a hidden draft — publishing is a separate,
 *  deliberate PATCH once the curator has actually filled it in. */
export async function POST(request: Request) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { name?: unknown; area?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const area = typeof body.area === "string" ? body.area.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const slug = slugify(name);
  if (!slug) return NextResponse.json({ error: "name must contain at least one letter or number" }, { status: 400 });

  try {
    const venue = await createVenue({ slug, name, area });
    return NextResponse.json({ ok: true, venue });
  } catch (err) {
    if (String(err).includes("venues_slug_key")) {
      return NextResponse.json({ error: `A venue already exists with slug "${slug}"` }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
