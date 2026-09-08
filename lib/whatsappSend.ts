/**
 * Sends outbound messages via Meta's WhatsApp Cloud API.
 *
 * Requires WHATSAPP_ACCESS_TOKEN (a Meta System User or temporary access
 * token) and WHATSAPP_PHONE_NUMBER_ID (Meta's numeric Phone Number ID —
 * distinct from WHATSAPP_BUSINESS_NUMBER, which only builds the wa.me opt-in
 * link and is never sent to the Graph API).
 */
export async function sendWhatsappText(to: string, body: string): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return false;

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });
    if (!res.ok) {
      console.error(`sendWhatsappText: Graph API ${res.status}: ${await res.text().catch(() => "")}`);
      return false;
    }
    return true;
  } catch (err) {
    // Never let an outbound-send failure surface as an error to the caller —
    // the webhook still needs to ack Meta's request either way.
    console.error("sendWhatsappText: request failed", err);
    return false;
  }
}
