import crypto from "node:crypto";
import { query } from "@/lib/db";

export const VENUE_SESSION_COOKIE = "scene044_venue_session";
export const VENUE_SESSION_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface VenueUser {
  id: number;
  phoneE164: string;
  name: string;
  email: string | null;
  role: "Organiser" | "Host";
  venue: string | null;
  hostVenueSlug?: string | null;
}

export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits;
  return null;
}

export function publicVenueProfile(user: VenueUser) {
  return {
    name: user.name,
    phone: user.phoneE164.slice(2),
    email: user.email ?? undefined,
    role: user.role,
    venue: user.venue ?? undefined,
  };
}

export function hashVenueSession(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newVenueSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function cookieValue(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const part = cookie.split(";").find((entry) => entry.trim().startsWith(`${VENUE_SESSION_COOKIE}=`));
  return part?.trim().slice(VENUE_SESSION_COOKIE.length + 1) ?? null;
}

export async function getVenueUserFromRequest(request: Request): Promise<VenueUser | null> {
  const token = cookieValue(request);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { rows } = await query<VenueUser>(
    `SELECT u.id, u.phone_e164 AS "phoneE164", u.name, u.email,
       CASE WHEN h.id IS NOT NULL THEN 'Host' ELSE 'Organiser' END AS role,
       CASE WHEN h.id IS NOT NULL THEN v.name ELSE NULL END AS venue,
       CASE WHEN h.id IS NOT NULL THEN v.slug ELSE NULL END AS "hostVenueSlug"
       FROM venue_user_sessions s JOIN venue_users u ON u.id = s.user_id
       LEFT JOIN venue_host_access h ON h.phone_e164 = u.phone_e164
         AND h.venue_slug = s.host_venue_slug AND h.revoked_at IS NULL
       LEFT JOIN venues v ON v.slug = h.venue_slug
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [hashVenueSession(token)],
  );
  return rows[0] ?? null;
}

export async function revokeVenueSession(request: Request): Promise<void> {
  const token = cookieValue(request);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return;
  await query(`UPDATE venue_user_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [hashVenueSession(token)]);
}

export function isSecureVenueRequest(request: Request): boolean {
  // Railway terminates TLS before Next sees the request. Never let a
  // client-supplied forwarding header decide whether an auth cookie is Secure.
  return process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:";
}
