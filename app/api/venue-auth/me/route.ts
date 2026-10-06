import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getVenueUserFromRequest, publicVenueProfile, type VenueUser } from "@/lib/venueUserAuth";

export async function GET(request: Request) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  return NextResponse.json({ ok: true, profile: publicVenueProfile(user) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const user = await getVenueUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  let body: { name?: unknown; email?: unknown; venue?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : user.email;
  const venue = typeof body.venue === "string" ? body.venue.trim() : user.venue;
  if (name.length < 2 || name.length > 120 || (email && !/^\S+@\S+\.\S+$/.test(email)) || (email && email.length > 300)) {
    return NextResponse.json({ error: "Enter a valid name and email address." }, { status: 400 });
  }
  const { rows } = await query<VenueUser>(
    `UPDATE venue_users SET name = $1, email = $2, venue = $3 WHERE id = $4
     RETURNING id, phone_e164 AS "phoneE164", name, email, role, venue`,
    [name, email || null, venue?.slice(0, 150) || null, user.id],
  );
  return NextResponse.json({ ok: true, profile: publicVenueProfile(rows[0]) });
}
