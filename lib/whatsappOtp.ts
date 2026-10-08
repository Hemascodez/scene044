/**
 * Phone-number verification for booking forms: a 6-digit code sent over
 * WhatsApp (an Authentication-category template, per Meta's requirements for
 * OTP messages), stored as a keyed digest, short-lived and attempt-capped.
 */

import crypto from "node:crypto";
import { HOST_ACCESS_MESSAGE, HOST_VENUE_SLUG } from '@/lib/venueHostAccess';
import { pool, query } from "@/lib/db";
import { sendWhatsappTemplate, type WhatsappTemplateSendResult } from "@/lib/whatsappSend";
import {
  hashVenueSession,
  newVenueSessionToken,
  normalizeIndianPhone,
  VENUE_SESSION_AGE_SECONDS,
  type VenueUser,
} from "@/lib/venueUserAuth";

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;

export type SendOtpResult =
  | { ok: true }
  | { ok: false; kind: "cooldown" | "config" | "send_failed"; error: string; retryAfterSeconds?: number };

export type VerifyOtpResult = { ok: true; user: VenueUser; sessionToken: string } | { ok: false; error: string; forbidden?: boolean };

export interface VenueSignupDetails {
  name?: string;
  email?: string;
  role?: "Organiser" | "Host";
  venue?: string;
}

function otpHashKey(): string | null {
  return process.env.WHATSAPP_OTP_HASH_SECRET?.trim()
    || process.env.WHATSAPP_APP_SECRET?.trim()
    || process.env.WHATSAPP_ACCESS_TOKEN?.trim()
    || null;
}

function hashCode(phone: string, code: string, key: string): string {
  // A plain hash of a 6-digit code is brute-forceable from a DB dump.
  return crypto.createHmac("sha256", key).update(`${phone}:${code}`).digest("hex");
}

function randomCode(): string {
  // 100000-999999: always 6 digits, never a leading zero that could get
  // trimmed by something upstream treating it as a number.
  return String(crypto.randomInt(100000, 1000000));
}

function otpTemplateConfig(): { name: string; language: string } | null {
  const name = process.env.WHATSAPP_OTP_TEMPLATE_NAME?.trim();
  const language = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE?.trim();
  if (!name || !language) return null;
  return { name, language };
}

export async function sendPhoneOtp(rawPhone: string): Promise<SendOtpResult> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) return { ok: false, kind: "config", error: "Enter a valid Indian mobile number." };

  const template = otpTemplateConfig();
  if (!template) {
    return {
      ok: false,
      kind: "config",
      error: "WHATSAPP_OTP_TEMPLATE_NAME and WHATSAPP_OTP_TEMPLATE_LANGUAGE are required",
    };
  }
  const hashKey = otpHashKey();
  if (!hashKey) return { ok: false, kind: "config", error: "WhatsApp OTP hash key is not configured" };

  const { rows: recent } = await query<{ seconds_ago: number }>(
    `SELECT EXTRACT(EPOCH FROM (now() - created_at))::int AS seconds_ago
       FROM phone_otp_verifications
      WHERE phone = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [phone],
  );
  const secondsSinceLast = recent[0]?.seconds_ago;
  if (secondsSinceLast !== undefined && secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
    return {
      ok: false,
      kind: "cooldown",
      error: "Please wait before requesting another code.",
      retryAfterSeconds: RESEND_COOLDOWN_SECONDS - secondsSinceLast,
    };
  }

  const code = randomCode();
  let sendResult: WhatsappTemplateSendResult;
  try {
    sendResult = await sendWhatsappTemplate({
      to: phone,
      name: template.name,
      language: template.language,
      bodyParameters: [code],
      // The Authentication template's "Copy Code" button carries the same code.
      urlButtonSuffix: code,
    });
  } catch (err) {
    return { ok: false, kind: "send_failed", error: err instanceof Error ? err.message : "WhatsApp send failed" };
  }
  if (!sendResult.ok) {
    return { ok: false, kind: "send_failed", error: sendResult.error };
  }

  await query(
    `INSERT INTO phone_otp_verifications (phone, code_hash, expires_at)
     VALUES ($1, $2, now() + interval '${CODE_TTL_MINUTES} minutes')`,
    [phone, hashCode(phone, code, hashKey)],
  );

  return { ok: true };
}

export async function verifyPhoneOtp(rawPhone: string, rawCode: string, details: VenueSignupDetails = {}): Promise<VerifyOtpResult> {
  const phone = normalizeIndianPhone(rawPhone);
  const code = rawCode.trim();
  if (!phone || !/^\d{6}$/.test(code)) {
    return { ok: false, error: "Enter the 6-digit code." };
  }
  const hashKey = otpHashKey();
  if (!hashKey) throw new Error("WhatsApp OTP hash key is not configured");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (details.role === 'Host') {
      const approval = await client.query(
        `SELECT id FROM venue_host_access WHERE venue_slug = $1 AND phone_e164 = $2 AND revoked_at IS NULL FOR SHARE`,
        [HOST_VENUE_SLUG, phone],
      );
      if (details.venue !== 'Time Cafe' || !approval.rows.length) {
        await client.query('ROLLBACK');
        return { ok: false, error: HOST_ACCESS_MESSAGE, forbidden: true };
      }
    }
    const { rows } = await client.query<{ id: number; code_hash: string; attempts: number; expired: boolean }>(
      `SELECT id, code_hash, attempts, (expires_at < now()) AS expired
         FROM phone_otp_verifications
        WHERE phone = $1 AND verified_at IS NULL
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [phone],
    );
    const record = rows[0];
    if (!record || record.expired || record.attempts >= MAX_VERIFY_ATTEMPTS) {
      await client.query("COMMIT");
      return { ok: false, error: !record ? "Request a new code first." : record.expired ? "That code expired. Request a new one." : "Too many attempts. Request a new code." };
    }

    const expected = Buffer.from(hashCode(phone, code, hashKey));
    const actual = Buffer.from(record.code_hash);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      await client.query(`UPDATE phone_otp_verifications SET attempts = attempts + 1 WHERE id = $1`, [record.id]);
      await client.query("COMMIT");
      return { ok: false, error: "Incorrect code." };
    }

    const name = details.name?.trim().slice(0, 120) || "Organiser";
    const email = details.email?.trim().toLowerCase().slice(0, 300) || null;
    const role = details.role === "Host" ? "Host" : "Organiser";
    const venue = role === 'Host' ? 'Time Cafe' : null;
    const { rows: users } = await client.query<VenueUser>(
      `INSERT INTO venue_users (phone_e164, name, email, role, venue)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (phone_e164) DO UPDATE SET
         name = CASE WHEN venue_users.name = 'Organiser' AND EXCLUDED.name <> 'Organiser'
                     THEN EXCLUDED.name ELSE venue_users.name END,
         email = COALESCE(venue_users.email, EXCLUDED.email),
         role = EXCLUDED.role, venue = EXCLUDED.venue,
         last_verified_at = now()
       RETURNING id, phone_e164 AS "phoneE164", name, email, role, venue`,
      [phone, name, email, role, venue],
    );
    const user = users[0];
    // Older bookings have no account id. Claim only unowned records matching
    // the now verified number; both historical 10-digit and +91 formats exist.
    await client.query(
      `UPDATE venue_bookings SET organizer_user_id = $1
        WHERE organizer_user_id IS NULL
          AND regexp_replace(organizer_phone, '[^0-9]', '', 'g') IN ($2, right($2, 10))`,
      [user.id, phone],
    );
    const sessionToken = newVenueSessionToken();
    await client.query(
      `INSERT INTO venue_user_sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
      [user.id, hashVenueSession(sessionToken), VENUE_SESSION_AGE_SECONDS],
    );
    // A successful newer code retires older outstanding codes too; they must
    // not be replayable to create a second session after this login.
    await client.query(
      `UPDATE phone_otp_verifications SET verified_at = now()
        WHERE phone = $2 AND id <= $1 AND verified_at IS NULL`,
      [record.id, phone],
    );
    await client.query("COMMIT");
    return { ok: true, user, sessionToken };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
