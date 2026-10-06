import { NextResponse } from "next/server";
import { verifyPhoneOtp } from "@/lib/whatsappOtp";
import { isSecureVenueRequest, publicVenueProfile, VENUE_SESSION_AGE_SECONDS, VENUE_SESSION_COOKIE } from "@/lib/venueUserAuth";

interface VerifyOtpBody {
  phone?: unknown;
  code?: unknown;
  name?: unknown;
  email?: unknown;
  role?: unknown;
  venue?: unknown;
}

export async function POST(request: Request) {
  let body: VerifyOtpBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!phone || !code) {
    return NextResponse.json({ error: "phone and code are required" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  if ((name && (name.length < 2 || name.length > 120)) || (email && (email.length > 300 || !/^\S+@\S+\.\S+$/.test(email)))) {
    return NextResponse.json({ error: "Enter a valid name and email address." }, { status: 400 });
  }

  let result;
  try {
    result = await verifyPhoneOtp(phone, code, {
      name,
      email,
      role: body.role === "Host" ? "Host" : "Organiser",
      venue: typeof body.venue === "string" ? body.venue : undefined,
    });
  } catch (err) {
    console.error("whatsapp verify-otp: failed", err);
    return NextResponse.json({ error: "Could not verify right now. Try again shortly." }, { status: 500 });
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, profile: publicVenueProfile(result.user) }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({
    name: VENUE_SESSION_COOKIE,
    value: result.sessionToken,
    httpOnly: true,
    secure: isSecureVenueRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge: VENUE_SESSION_AGE_SECONDS,
  });
  return response;
}
