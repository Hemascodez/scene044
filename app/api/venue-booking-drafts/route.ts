import { NextResponse } from "next/server";
import { getCatalogVenue } from "@/lib/venueCatalog";
import { deleteVenueBookingDraft, getVenueBookingDraft, saveVenueBookingDraft } from "@/lib/venueBookingDrafts";
import { getVenueUserFromRequest } from "@/lib/venueUserAuth";

const noStore = { "Cache-Control": "no-store" };

function slug(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9-]{1,100}$/.test(value) ? value : null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

// Accept incomplete values (a draft is not a booking), but never arbitrary
// keys, OTPs, consent checkboxes, or unlimited client-controlled JSON.
function cleanFormData(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.kind !== "figma" && raw.kind !== "generic") return null;
  const cleaned: Record<string, unknown> = { kind: raw.kind };
  for (const [key, max] of Object.entries({
    eventType: 100, date: 20, time: 10, start: 10, guests: 8,
    description: 4000, message: 4000, social: 500,
    name: 120, email: 300, phone: 40, trustType: 40, trustUrl: 500,
  })) {
    if (raw[key] === undefined) continue;
    const value = text(raw[key], max);
    if (value === null) return null;
    cleaned[key] = value;
  }
  for (const key of ["duration", "hours", "people", "step"]) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== "number" || !Number.isInteger(raw[key]) || raw[key] < 0 || raw[key] > 10000) return null;
    cleaned[key] = raw[key];
  }
  return cleaned;
}

export async function GET(request: Request) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to see saved requests." }, { status: 401, headers: noStore });
  const venueSlug = slug(new URL(request.url).searchParams.get("venueSlug"));
  if (!venueSlug) return NextResponse.json({ error: "Invalid venue." }, { status: 400, headers: noStore });
  const row = await getVenueBookingDraft(user.id, venueSlug);
  return NextResponse.json({
    ok: true,
    draft: row && row.editedAtMs > row.submittedAtMs ? row : null,
    clearedAtMs: row?.submittedAtMs ?? 0,
  }, { headers: noStore });
}

export async function PUT(request: Request) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to save this request." }, { status: 401, headers: noStore });
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return NextResponse.json({ error: "Draft is too large." }, { status: 413, headers: noStore });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid draft." }, { status: 400, headers: noStore });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid draft." }, { status: 400, headers: noStore });
  }
  const venueSlug = slug(body.venueSlug);
  const spaceId = slug(body.spaceId);
  const formData = cleanFormData(body.formData);
  const editedAtMs = body.editedAtMs;
  if (!venueSlug || !spaceId || !formData || typeof editedAtMs !== "number" ||
      !Number.isSafeInteger(editedAtMs) || editedAtMs < 1 || editedAtMs > Date.now() + 300000) {
    return NextResponse.json({ error: "Invalid draft details." }, { status: 400, headers: noStore });
  }
  const venue = await getCatalogVenue(venueSlug);
  if (venue?.status !== "live" || !venue.spaces.some((space) => space.id === spaceId)) {
    return NextResponse.json({ error: "This space is not available." }, { status: 400, headers: noStore });
  }
  const draft = await saveVenueBookingDraft(user.id, venueSlug, spaceId, formData, editedAtMs);
  if (!draft) return NextResponse.json({ error: "A newer draft was saved on another device." }, { status: 409, headers: noStore });
  return NextResponse.json({ ok: true, draft }, { headers: noStore });
}

export async function DELETE(request: Request) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to clear this request." }, { status: 401, headers: noStore });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid draft." }, { status: 400, headers: noStore });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid draft." }, { status: 400, headers: noStore });
  }
  const venueSlug = slug(body.venueSlug);
  const spaceId = slug(body.spaceId);
  if (!venueSlug || !spaceId) return NextResponse.json({ error: "Invalid draft details." }, { status: 400, headers: noStore });
  await deleteVenueBookingDraft(user.id, venueSlug, spaceId);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
