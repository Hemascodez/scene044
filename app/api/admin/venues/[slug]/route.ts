import { NextResponse } from "next/server";
import { checkCuratorAccess } from "@/lib/auth";
import { deleteVenue, getCatalogVenue, updateVenue, type VenueWritableFields } from "@/lib/venueCatalog";

const VENUE_STATUSES = ["live", "coming-soon", "hidden"];

interface UpdateBody {
  name?: unknown;
  area?: unknown;
  city?: unknown;
  address?: unknown;
  summary?: unknown;
  status?: unknown;
  rating?: unknown;
  ratingCount?: unknown;
  ratingUrl?: unknown;
  phone?: unknown;
  mapUrl?: unknown;
  mapEmbedUrl?: unknown;
  photos?: unknown;
  amenities?: unknown;
  policies?: unknown;
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value.trim() : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  try {
    const venue = await getCatalogVenue(slug);
    if (!venue) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, venue });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}

/**
 * Edits any field of the venue's public page — the point of moving venue data
 * into the database instead of a hardcoded TS constant.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await params;

  let body: UpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (body.status !== undefined && !VENUE_STATUSES.includes(String(body.status))) {
    return NextResponse.json({ error: "status must be live, coming-soon, or hidden" }, { status: 400 });
  }

  const fields: VenueWritableFields = {};
  const name = optionalString(body.name);
  if (name !== undefined) fields.name = name ?? "";
  const area = optionalString(body.area);
  if (area !== undefined) fields.area = area ?? "";
  const city = optionalString(body.city);
  if (city !== undefined) fields.city = city ?? "Chennai";
  const summary = optionalString(body.summary);
  if (summary !== undefined) fields.summary = summary ?? "";
  if (body.address !== undefined) fields.address = optionalString(body.address) ?? null;
  if (body.phone !== undefined) fields.phone = optionalString(body.phone) ?? null;
  if (body.ratingUrl !== undefined) fields.ratingUrl = optionalString(body.ratingUrl) ?? null;
  if (body.mapUrl !== undefined) fields.mapUrl = optionalString(body.mapUrl) ?? null;
  if (body.mapEmbedUrl !== undefined) fields.mapEmbedUrl = optionalString(body.mapEmbedUrl) ?? null;
  if (body.status !== undefined) fields.status = body.status as VenueWritableFields["status"];
  if (body.rating !== undefined) fields.rating = optionalNumber(body.rating) ?? null;
  if (body.ratingCount !== undefined) fields.ratingCount = optionalNumber(body.ratingCount) ?? null;
  const photos = optionalStringArray(body.photos);
  if (photos !== undefined) fields.photos = photos;
  const amenities = optionalStringArray(body.amenities);
  if (amenities !== undefined) fields.amenities = amenities;
  const policies = optionalStringArray(body.policies);
  if (policies !== undefined) fields.policies = policies;

  try {
    const venue = await updateVenue(slug, fields);
    if (!venue) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, venue });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await checkCuratorAccess(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  try {
    const deleted = await deleteVenue(slug);
    if (!deleted) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err).slice(0, 500) }, { status: 500 });
  }
}
