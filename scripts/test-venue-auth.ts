/** No database or WhatsApp send needed: exercises account boundary behavior. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { Pool } from "pg";
import {
  getVenueUserFromRequest,
  hashVenueSession,
  newVenueSessionToken,
  normalizeIndianPhone,
  publicVenueProfile,
  VENUE_SESSION_COOKIE,
} from "../lib/venueUserAuth";
import { GET as getProfile, PATCH as patchProfile } from "../app/api/venue-auth/me/route";
import { POST as logout } from "../app/api/venue-auth/logout/route";
import { GET as listBookings, POST as createBooking } from "../app/api/venue-bookings/route";
import { GET as getBooking, DELETE as withdrawBooking } from "../app/api/venue-bookings/[token]/route";
import { POST as createOrder } from "../app/api/razorpay/create-order/route";
import { POST as verifyPayment } from "../app/api/razorpay/verify-payment/route";
import { POST as verifyOtp } from "../app/api/whatsapp/verify-otp/route";

function request(path: string, method = "GET"): Request {
  return new Request(`http://localhost:3000${path}`, { method });
}

async function main() {
  assert.equal(normalizeIndianPhone("9876543210"), "919876543210");
  assert.equal(normalizeIndianPhone("+91 98765 43210"), "919876543210");
  assert.equal(normalizeIndianPhone("+1 9876543210"), null);
  assert.equal(normalizeIndianPhone("1234567890"), null);
  assert.equal(normalizeIndianPhone(""), null);

  const token = newVenueSessionToken();
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.notEqual(hashVenueSession(token), token);
  assert.notEqual(newVenueSessionToken(), token);
  assert.deepEqual(publicVenueProfile({
    id: 1, phoneE164: "919876543210", name: "Test", email: null,
    role: "Organiser", venue: null,
  }), { name: "Test", phone: "9876543210", email: undefined, role: "Organiser", venue: undefined });

  assert.equal(await getVenueUserFromRequest(request("/api/venue-auth/me")), null);
  assert.equal((await getProfile(request("/api/venue-auth/me"))).status, 401);
  assert.equal((await patchProfile(request("/api/venue-auth/me", "PATCH"))).status, 401);
  assert.equal((await listBookings(request("/api/venue-bookings"))).status, 401);
  assert.equal((await createBooking(request("/api/venue-bookings", "POST"))).status, 401);
  const context = { params: Promise.resolve({ token: "dummy" }) };
  assert.equal((await getBooking(request("/api/venue-bookings/dummy"), context)).status, 401);
  assert.equal((await withdrawBooking(request("/api/venue-bookings/dummy", "DELETE"), context)).status, 401);
  assert.equal((await createOrder(request("/api/razorpay/create-order", "POST"))).status, 401);
  assert.equal((await verifyPayment(request("/api/razorpay/verify-payment", "POST"))).status, 401);
  const malformedProfile = await verifyOtp(new Request("http://localhost:3000/api/whatsapp/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9876543210", code: "123456", name: "X", email: "not-an-email" }),
  }));
  assert.equal(malformedProfile.status, 400);

  const loggedOut = await logout(request("/api/venue-auth/logout", "POST"));
  assert.equal(loggedOut.status, 200);
  assert.match(loggedOut.headers.get("set-cookie") ?? "", new RegExp(`^${VENUE_SESSION_COOKIE}=;`));

  // A tiny SQL adapter tests the real route and session wiring without
  // touching the live Supabase database or sending an actual WhatsApp code.
  const phone = "919876543210";
  const code = "123456";
  const secret = "test-only-otp-key";
  process.env.WHATSAPP_OTP_HASH_SECRET = secret;
  const otp = {
    id: 1,
    code_hash: crypto.createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex"),
    attempts: 0,
    verified: false,
  };
  let userId: number | null = null;
  let sessionHash: string | null = null;
  let sessionRevoked = false;
  let legacyBookingOwner: number | null = null;
  const user = {
    id: 7, phoneE164: phone, name: "Test Organiser", email: "test@example.com",
    role: "Organiser" as const, venue: null,
  };
  const sqlQuery = async (sql: string, params: unknown[] = []) => {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
    if (sql.includes("FROM phone_otp_verifications") && sql.includes("FOR UPDATE")) {
      return { rows: otp.verified ? [] : [{ id: otp.id, code_hash: otp.code_hash, attempts: otp.attempts, expired: false }] };
    }
    if (sql.includes("UPDATE phone_otp_verifications SET attempts")) {
      otp.attempts++;
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO venue_users")) {
      userId = user.id;
      return { rows: [user] };
    }
    if (sql.includes("UPDATE venue_bookings SET organizer_user_id")) {
      legacyBookingOwner = params[0] as number;
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO venue_user_sessions")) {
      sessionHash = params[1] as string;
      return { rows: [] };
    }
    if (sql.includes("UPDATE phone_otp_verifications SET verified_at")) {
      otp.verified = true;
      return { rows: [] };
    }
    if (sql.includes("FROM venue_user_sessions s JOIN venue_users")) {
      return { rows: !sessionRevoked && params[0] === sessionHash && userId ? [user] : [] };
    }
    if (sql.includes("FROM venue_bookings") && sql.includes("WHERE organizer_user_id")) {
      return { rows: params[0] === legacyBookingOwner ? [{ checkinToken: "a".repeat(48) }] : [] };
    }
    if (sql.includes("UPDATE venue_user_sessions SET revoked_at")) {
      if (params[0] === sessionHash) sessionRevoked = true;
      return { rows: [] };
    }
    throw new Error(`Unexpected SQL in auth test: ${sql.slice(0, 100)}`);
  };
  globalThis.__pgPool = {
    query: sqlQuery,
    connect: async () => ({ query: sqlQuery, release: () => undefined }),
  } as unknown as Pool;

  const wrongCode = await verifyOtp(new Request("http://localhost:3000/api/whatsapp/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9876543210", code: "654321" }),
  }));
  assert.equal(wrongCode.status, 400);
  assert.equal(otp.attempts, 1);

  const verified = await verifyOtp(new Request("http://localhost:3000/api/whatsapp/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9876543210", code, name: user.name, email: user.email }),
  }));
  assert.equal(verified.status, 200);
  const cookie = (verified.headers.get("set-cookie") ?? "").split(";")[0];
  assert.match(cookie, new RegExp(`^${VENUE_SESSION_COOKIE}=[0-9a-f]{64}$`));
  assert.match(verified.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.equal(legacyBookingOwner, user.id);
  const authenticated = new Request("http://localhost:3000/api/venue-auth/me", { headers: { Cookie: cookie } });
  assert.equal((await getProfile(authenticated)).status, 200);
  assert.equal((await listBookings(new Request("http://localhost:3000/api/venue-bookings", { headers: { Cookie: cookie } }))).status, 200);
  assert.equal((await verifyOtp(new Request("http://localhost:3000/api/whatsapp/verify-otp", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9876543210", code }),
  }))).status, 400, "OTP cannot be replayed");
  assert.equal((await logout(new Request("http://localhost:3000/api/venue-auth/logout", { method: "POST", headers: { Cookie: cookie } }))).status, 200);
  assert.equal((await getProfile(authenticated)).status, 401, "logout revokes the server session");
  console.log("PASS venue auth normalization, ownership guards, OTP replay, cross-device account read, and logout");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
