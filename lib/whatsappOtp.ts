/**
 * Phone-number verification for booking forms: a 6-digit code sent over
 * WhatsApp (an Authentication-category template, per Meta's requirements for
 * OTP messages), stored only as a SHA-256 hash, short-lived and attempt-capped.
 */

import crypto from "node:crypto";
import { query } from "@/lib/db";
import { recipientDigits, sendWhatsappTemplate, type WhatsappTemplateSendResult } from "@/lib/whatsappSend";

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;

export type SendOtpResult =
  | { ok: true }
  | { ok: false; kind: "cooldown" | "config" | "send_failed"; error: string; retryAfterSeconds?: number };

export type VerifyOtpResult = { ok: true } | { ok: false; error: string };

function hashCode(phone: string, code: string): string {
  return crypto.createHash("sha256").update(`${phone}:${code}`).digest("hex");
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
  const phone = recipientDigits(rawPhone);
  if (phone.length < 10) return { ok: false, kind: "config", error: "Enter a valid phone number." };

  const template = otpTemplateConfig();
  if (!template) {
    return {
      ok: false,
      kind: "config",
      error: "WHATSAPP_OTP_TEMPLATE_NAME and WHATSAPP_OTP_TEMPLATE_LANGUAGE are required",
    };
  }

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
    [phone, hashCode(phone, code)],
  );

  return { ok: true };
}

export async function verifyPhoneOtp(rawPhone: string, rawCode: string): Promise<VerifyOtpResult> {
  const phone = recipientDigits(rawPhone);
  const code = rawCode.trim();
  if (!phone || !/^\d{6}$/.test(code)) {
    return { ok: false, error: "Enter the 6-digit code." };
  }

  const { rows } = await query<{ id: number; code_hash: string; attempts: number; expired: boolean }>(
    `SELECT id, code_hash, attempts, (expires_at < now()) AS expired
       FROM phone_otp_verifications
      WHERE phone = $1 AND verified_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [phone],
  );
  const record = rows[0];
  if (!record) return { ok: false, error: "Request a new code first." };
  if (record.expired) return { ok: false, error: "That code expired. Request a new one." };
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  const expected = hashCode(phone, code);
  const a = Buffer.from(expected);
  const b = Buffer.from(record.code_hash);
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!matches) {
    await query(`UPDATE phone_otp_verifications SET attempts = attempts + 1 WHERE id = $1`, [record.id]);
    return { ok: false, error: "Incorrect code." };
  }

  await query(`UPDATE phone_otp_verifications SET verified_at = now() WHERE id = $1`, [record.id]);
  return { ok: true };
}
