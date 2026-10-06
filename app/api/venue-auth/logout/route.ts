import { NextResponse } from "next/server";
import { revokeVenueSession, VENUE_SESSION_COOKIE } from "@/lib/venueUserAuth";

export async function POST(request: Request) {
  await revokeVenueSession(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: VENUE_SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
}
