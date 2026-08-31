import { NextResponse } from "next/server";
import { CURATOR_SESSION_COOKIE } from "@/lib/auth";

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

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: CURATOR_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: 0,
  });
  return response;
}
