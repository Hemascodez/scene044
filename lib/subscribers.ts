import { query } from "@/lib/db";
import { CATEGORIES, type Category } from "@/lib/types";

/**
 * Subscriber storage and consent rules.
 *
 * The two channels have genuinely different consent models and this module
 * keeps them apart on purpose:
 *
 *   email    — typing an address into the signup field is the consent. There
 *              is no confirmation step by product decision.
 *   whatsapp — consent is the visitor's own inbound message to our business
 *              number, sent from a wa.me link. There is deliberately no
 *              function here that takes a phone number from a form, because
 *              a number typed into a field is not an opt-in under Meta's
 *              rules and messaging it would be unsolicited.
 */

export const MAX_EMAIL_LENGTH = 254; // RFC 5321 maximum forward-path length

export type SubscriberChannel = "email" | "whatsapp";
export type SubscriberStatus = "active" | "unsubscribed" | "bounced" | "blocked";

export interface SubscribeResult {
  ok: true;
  /** False when the address was already on the list — the caller should still
   *  respond identically, so the endpoint can't be used to test membership. */
  created: boolean;
  unsubscribeToken: string;
}

export interface WhatsappSubscriber {
  id: number;
  phone: string;
  name: string | null;
  role: string | null;
  message: string | null;
  categories: Category[];
  source: string;
  consentNote: string | null;
  status: SubscriberStatus;
  createdAt: Date;
}

export interface WhatsappSubscribeResult extends SubscribeResult {
  subscriber: WhatsappSubscriber;
}

/**
 * Lowercases and trims. Deliberately does NOT strip Gmail dots or +tags:
 * that's a guess about which provider treats them as equivalent, and getting
 * it wrong silently merges two real people into one row.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * A deliberately loose check. Without a verification step there's no way to
 * know an address is real, so the only job here is to reject input that
 * certainly isn't an address — anything stricter starts rejecting valid ones
 * (apostrophes, plus tags, long TLDs, unicode domains).
 */
export function isPlausibleEmail(value: string): boolean {
  if (value.length < 6 || value.length > MAX_EMAIL_LENGTH) return false;
  if (/\s/.test(value)) return false;
  const parts = value.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (!domain.includes(".")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
  return true;
}

/**
 * Normalises an Indian mobile number to E.164.
 *
 * Only ever fed by a messaging provider's webhook (which reports the sender's
 * number), never by user input — see the module comment.
 */
export function normalizePhoneE164(raw: string, defaultCountryCode = "91"): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  // Already international.
  if (raw.trim().startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  // 0-prefixed domestic form, or an 11-15 digit number that already carries a
  // country code (WhatsApp reports numbers this way).
  if (digits.length === 11 && digits.startsWith("0")) return `+${defaultCountryCode}${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

/** Unguessable, CSPRNG-backed, never derived from the address itself — a
 *  token derived from the email would let anyone unsubscribe anyone. */
export function newUnsubscribeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Drops anything not in the allowlist. An empty result means "all fields",
 *  which is what an untouched checkbox group should mean. */
export function sanitizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(CATEGORIES);
  const out: Category[] = [];
  for (const value of raw) {
    if (typeof value === "string" && allowed.has(value) && !out.includes(value as Category)) {
      out.push(value as Category);
    }
  }
  return out;
}

/**
 * Idempotent by design. A repeat signup updates the category selection and
 * re-activates a previously unsubscribed row rather than erroring, so the
 * caller can always return the same response — an endpoint that answers
 * "already subscribed" differently is an address-enumeration oracle.
 */
export async function subscribeEmail(opts: {
  email: string;
  categories: Category[];
  source?: string;
  consentNote?: string | null;
}): Promise<SubscribeResult> {
  const email = normalizeEmail(opts.email);
  const token = newUnsubscribeToken();

  const { rows } = await query<{ unsubscribe_token: string; inserted: boolean }>(
    `INSERT INTO subscribers (channel, email, categories, unsubscribe_token, source, consent_note)
     VALUES ('email', $1, $2, $3, $4, $5)
     ON CONFLICT (lower(email)) WHERE email IS NOT NULL
     DO UPDATE SET
       categories = EXCLUDED.categories,
       status = 'active',
       unsubscribed_at = NULL
     RETURNING unsubscribe_token, (xmax = 0) AS inserted`,
    [email, opts.categories, token, opts.source ?? "web", opts.consentNote ?? null],
  );

  const row = rows[0];
  return { ok: true, created: row?.inserted ?? false, unsubscribeToken: row?.unsubscribe_token ?? token };
}

/**
 * Records a WhatsApp opt-in from an inbound message.
 *
 * Called by the verified Meta Cloud API webhook. Repeated messages update the
 * same subscriber row, preserving structured fields that a later free-form
 * message does not contain.
 */
export async function recordWhatsappOptIn(opts: {
  phone: string;
  name?: string | null;
  role?: string | null;
  message?: string | null;
  categories?: Category[];
  /** True when the inbound message explicitly included the interests field.
   *  This lets "All events" clear an earlier category selection while a
   *  free-form follow-up message leaves that selection unchanged. */
  replaceCategories?: boolean;
  source?: string;
  consentNote?: string | null;
}): Promise<WhatsappSubscribeResult | { ok: false; reason: "unparseable_phone" }> {
  const phone = normalizePhoneE164(opts.phone);
  if (!phone) return { ok: false, reason: "unparseable_phone" };

  const name = opts.name?.trim().slice(0, 200) || null;
  const role = opts.role?.trim().slice(0, 200) || null;
  const message = opts.message?.trim().slice(0, 4096) || null;
  const token = newUnsubscribeToken();
  const { rows } = await query<{
    id: number;
    phone_e164: string;
    name: string | null;
    role: string | null;
    message: string | null;
    categories: Category[];
    source: string;
    consent_note: string | null;
    status: SubscriberStatus;
    created_at: Date;
    unsubscribe_token: string;
    inserted: boolean;
  }>(
    `INSERT INTO subscribers
       (channel, phone_e164, name, role, message, categories, unsubscribe_token, source, consent_note)
     VALUES ('whatsapp', $1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (phone_e164) WHERE phone_e164 IS NOT NULL
     DO UPDATE SET
       name = COALESCE(EXCLUDED.name, subscribers.name),
       role = COALESCE(EXCLUDED.role, subscribers.role),
       message = COALESCE(EXCLUDED.message, subscribers.message),
       categories = CASE
         WHEN $9::boolean THEN EXCLUDED.categories
         ELSE subscribers.categories
       END,
       status = 'active',
       unsubscribed_at = NULL
     RETURNING id, phone_e164, name, role, message, categories, source,
               consent_note, status, created_at, unsubscribe_token,
               (xmax = 0) AS inserted`,
    [
      phone,
      name,
      role,
      message,
      opts.categories ?? [],
      token,
      opts.source ?? "whatsapp_inbound",
      opts.consentNote ?? "User-initiated inbound WhatsApp message (wa.me link).",
      opts.replaceCategories ?? false,
    ],
  );

  const row = rows[0];
  if (!row) throw new Error("WhatsApp subscriber upsert returned no row");

  return {
    ok: true,
    created: row.inserted,
    unsubscribeToken: row.unsubscribe_token,
    subscriber: {
      id: row.id,
      phone: row.phone_e164,
      name: row.name,
      role: row.role,
      message: row.message,
      categories: row.categories,
      source: row.source,
      consentNote: row.consent_note,
      status: row.status,
      createdAt: row.created_at,
    },
  };
}

/** Returns false only when the token matches nothing. Unsubscribing an
 *  already-unsubscribed row is a success, not an error. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!token || token.length < 16) return false;
  const { rowCount } = await query(
    `UPDATE subscribers
        SET status = 'unsubscribed', unsubscribed_at = COALESCE(unsubscribed_at, now())
      WHERE unsubscribe_token = $1`,
    [token],
  );
  return (rowCount ?? 0) > 0;
}
