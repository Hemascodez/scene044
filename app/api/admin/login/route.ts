import { NextResponse } from "next/server";
import {
  CURATOR_SESSION_COOKIE,
  CURATOR_SESSION_MAX_AGE_SECONDS,
  createCuratorSessionToken,
  isCuratorPasswordCorrect,
} from "@/lib/auth";

/**
 * `Secure` is decided by the actual request scheme, not NODE_ENV.
 *
 * `next start` sets NODE_ENV=production even on a plain-HTTP LAN address, and a
 * Secure cookie is silently dropped over http on anything that isn't localhost
 * — so testing from a phone on the same wifi would fail to log in with no
 * visible error. Behind a proxy (Vercel) x-forwarded-proto is authoritative.
 */
function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Deliberately not rate-limited in code — this is a single-operator internal
 *  tool behind an unguessable URL. If it ever faces the open internet, add a
 *  per-IP limiter here before anything else. */
export async function POST(request: Request) {
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const supplied = typeof body.password === "string" ? body.password : "";
  if (!supplied) {
    return NextResponse.json({ error: "Enter the access code." }, { status: 400 });
  }

  if (!process.env.CURATOR_PASSWORD) {
    // Misconfiguration is a server problem, not a wrong-password problem, and
    // saying so avoids an operator hunting for a typo that isn't there.
    return NextResponse.json(
      { error: "CURATOR_PASSWORD is not set on the server." },
      { status: 500 },
    );
  }

  if (!isCuratorPasswordCorrect(supplied)) {
    return NextResponse.json({ error: "That access code is not correct." }, { status: 401 });
  }

  const token = await createCuratorSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Could not create a session." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: CURATOR_SESSION_COOKIE,
    value: token,
    httpOnly: true, // never readable from JS, so an XSS can't lift the session
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: CURATOR_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
