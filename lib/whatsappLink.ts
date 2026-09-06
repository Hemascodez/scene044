/**
 * wa.me opt-in link.
 *
 * This is the entire WhatsApp signup flow, and the direction matters: the
 * visitor messages US. Meta requires an opt-in before any business-initiated
 * message, and a user-initiated inbound message satisfies it while also
 * opening a 24-hour window in which replies are free (only business-initiated
 * template messages outside that window are billed, ~Rs 0.86 on the India
 * marketing rate).
 *
 * The consequence for the UI: there is no phone-number field. A number typed
 * into a form is not consent, and we must not collect one.
 */

/** Pre-filled text. Kept short and unambiguous because it becomes the visitor's
 *  own outgoing message, and because the words are what an operator sees as the
 *  opt-in record. */
const DEFAULT_OPT_IN_MESSAGE = "Hi SCENE/044 — send me Chennai tech events.";

export interface WhatsappOptInLink {
  href: string;
  /** The exact text the visitor will send, so the UI can show it before they tap. */
  message: string;
}

/** Digits only — wa.me rejects '+', spaces and dashes. */
function toWaDigits(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  // 10 (bare Indian mobile) is not enough; wa.me needs the country code.
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

/**
 * Returns null when no business number is configured, so callers can hide the
 * WhatsApp option entirely rather than rendering a dead link.
 */
export function buildWhatsappOptInLink(message = DEFAULT_OPT_IN_MESSAGE): WhatsappOptInLink | null {
  const configured = process.env.WHATSAPP_BUSINESS_NUMBER;
  if (!configured) return null;

  const digits = toWaDigits(configured);
  if (!digits) return null;

  return {
    href: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
    message,
  };
}
