import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { getCatalogVenue, upsertVenueSpace, type SpaceInput } from "@/lib/venueCatalog";

interface SpaceBody {
  spaceKey?: unknown;
  name?: unknown;
  eyebrow?: unknown;
  description?: unknown;
  capacity?: unknown;
  maxGuests?: unknown;
  image?: unknown;
  amenities?: unknown;
  communityRate?: unknown;
  productionRate?: unknown;
  minimumFoodSpend?: unknown;
  sortOrder?: unknown;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function slugifyKey(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/**
 * Creates or edits a room. One endpoint for both — the underlying upsert keys
 * on (venue, spaceKey), so re-saving the same room updates it in place rather
 * than duplicating it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await params;

  let body: SpaceBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const maxGuests = Number(body.maxGuests);
  if (!Number.isInteger(maxGuests) || maxGuests <= 0) {
    return NextResponse.json({ error: "maxGuests must be a positive integer" }, { status: 400 });
  }

  const spaceKey =
    typeof body.spaceKey === "string" && body.spaceKey.trim() ? slugifyKey(body.spaceKey) : slugifyKey(name);
  if (!spaceKey) return NextResponse.json({ error: "could not derive a room key from the name" }, { status: 400 });

  const amenities = Array.isArray(body.amenities)
    ? body.amenities.filter((item): item is string => typeof item === "string")
    : [];

  const input: SpaceInput = {
    spaceKey,
    name,
    eyebrow: typeof body.eyebrow === "string" ? body.eyebrow.trim() : "",
    description: typeof body.description === "string" ? body.description.trim() : "",
    capacity: typeof body.capacity === "string" ? body.capacity.trim() : "",
    maxGuests,
    image: typeof body.image === "string" && body.image.trim() ? body.image.trim() : null,
    amenities,
    communityRate: optionalNumber(body.communityRate),
    productionRate: optionalNumber(body.productionRate),
    minimumFoodSpend: optionalNumber(body.minimumFoodSpend),
    sortOrder: optionalNumber(body.sortOrder) ?? 0,
  };

  try {
    const venue = await getCatalogVenue(slug);
    if (!venue) return NextResponse.json({ error: "venue not found" }, { status: 404 });
    const space = await upsertVenueSpace(venue.id, input);
    return NextResponse.json({ ok: true, space });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
