/**
 * Curator access control.
 *
 * Two accepted credentials, both checked server-side:
 *
 *  1. A signed session cookie, issued by POST /api/admin/login. This is the
 *     path humans use. A browser-native HTTP Basic dialog was the original
 *     mechanism, but embedded webviews and preview panes routinely refuse to
 *     show it — the visitor just sees the bare 401 body and has no way in.
 *  2. An HTTP Basic header, kept for curl, cron and scripted checks.
 *
 * Everything fails closed: a missing CURATOR_PASSWORD denies access rather
 * than opening it.
 */

export const CURATOR_SESSION_COOKIE = "scene044_curator";

/** Long enough for a curation session, short enough that a shared laptop
 *  doesn't stay authenticated indefinitely. */
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const CURATOR_SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000;

const encoder = new TextEncoder();

/**
 * Web Crypto, not node:crypto — this runs in the Edge runtime (proxy.ts) as
 * well as in Node route handlers, and only Web Crypto exists in both.
 */
async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time comparison. A plain `===` on a secret leaks its prefix
 *  through timing, and node:crypto.timingSafeEqual isn't available on Edge. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isCuratorPasswordCorrect(supplied: string): boolean {
  const password = process.env.CURATOR_PASSWORD;
  if (!password) return false;
  return timingSafeEqual(supplied, password);
}

/**
 * Token is `<issuedAt>.<hmac>`, keyed by CURATOR_PASSWORD itself, so changing
 * the password invalidates every outstanding session for free.
 */
export async function createCuratorSessionToken(): Promise<string | null> {
  const password = process.env.CURATOR_PASSWORD;
  if (!password) return null;
  const issuedAt = String(Date.now());
  return `${issuedAt}.${await hmacHex(password, issuedAt)}`;
}

export async function isCuratorSessionValid(token: string | undefined | null): Promise<boolean> {
  const password = process.env.CURATOR_PASSWORD;
  if (!password || !token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;
  const issuedAt = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const age = Date.now() - Number(issuedAt);
  // A negative age means a clock-skewed or forged timestamp; reject either way.
  if (!Number.isFinite(age) || age < 0 || age > SESSION_MAX_AGE_MS) return false;

  return timingSafeEqual(signature, await hmacHex(password, issuedAt));
}

/** Basic-auth header check, for scripted callers. */
export function checkCuratorAuth(request: Request): boolean {
  const password = process.env.CURATOR_PASSWORD;
  if (!password) return false; // fail closed on misconfiguration

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const [scheme, encoded] = authHeader.split(" ");
  if (scheme !== "Basic" || !encoded) return false;

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return false;
  }
  const separatorIndex = decoded.indexOf(":");
  const suppliedPassword = separatorIndex === -1 ? decoded : decoded.slice(separatorIndex + 1);
  return timingSafeEqual(suppliedPassword, password);
}

/** Reads one cookie from a raw `Request`, which (unlike NextRequest) has no
 *  parsed cookie jar. */
function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/**
 * The check every /api/admin route uses: session cookie OR Basic header.
 *
 * Kept in the route handlers as well as in proxy.ts on purpose — if the
 * matcher is ever edited, the endpoints are still closed.
 */
export async function checkCuratorAccess(request: Request): Promise<boolean> {
  if (checkCuratorAuth(request)) return true;
  return isCuratorSessionValid(readCookie(request, CURATOR_SESSION_COOKIE));
}

export function checkCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed — a missing secret must never mean "open"
  const header = request.headers.get("authorization");
  if (!header) return false;
  return timingSafeEqual(header, `Bearer ${secret}`);
}
