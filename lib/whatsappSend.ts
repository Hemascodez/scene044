/** Meta Cloud API request helpers shared by service-window replies and templates. */

export interface WhatsappTemplateInput {
  to: string;
  name: string;
  language: string;
  bodyParameters: string[];
  /** Dynamic suffix for the template's first URL button. */
  urlButtonSuffix?: string;
  opaqueCallbackData?: string;
}

type WhatsappTemplateComponent =
  | {
      type: "body";
      parameters: Array<{ type: "text"; text: string }>;
    }
  | {
      type: "button";
      sub_type: "url";
      index: "0";
      parameters: Array<{ type: "text"; text: string }>;
    };

export interface WhatsappTemplatePayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components: WhatsappTemplateComponent[];
  };
  biz_opaque_callback_data?: string;
}

export type WhatsappTemplateSendResult =
  | { ok: true; providerMessageId: string }
  | {
      ok: false;
      kind: "retryable" | "fatal" | "rejected" | "unknown";
      status?: number;
      error: string;
    };

type FetchLike = typeof fetch;

function graphConfig(): { token: string; phoneNumberId: string; version: string } | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const version = process.env.WHATSAPP_GRAPH_API_VERSION?.trim();
  if (!token || !phoneNumberId || !version) return null;
  if (!/^v\d+\.\d+$/.test(version)) {
    throw new Error("WHATSAPP_GRAPH_API_VERSION must look like vXX.X");
  }
  return { token, phoneNumberId, version };
}

function recipientDigits(to: string): string {
  return to.replace(/\D/g, "");
}

export function buildWhatsappTemplatePayload(input: WhatsappTemplateInput): WhatsappTemplatePayload {
  const payload: WhatsappTemplatePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientDigits(input.to),
    type: "template",
    template: {
      name: input.name,
      language: { code: input.language },
      components: [
        {
          type: "body",
          parameters: input.bodyParameters.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };
  if (input.urlButtonSuffix) {
    payload.template.components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: input.urlButtonSuffix }],
    });
  }
  if (input.opaqueCallbackData) payload.biz_opaque_callback_data = input.opaqueCallbackData;
  return payload;
}

function errorDetails(body: unknown): { text: string; code: number | null } {
  if (body && typeof body === "object") {
    const error = (body as { error?: { message?: unknown; code?: unknown; error_subcode?: unknown } }).error;
    if (error) {
      const bits = [error.message, error.code, error.error_subcode]
        .filter((value) => value !== undefined && value !== null)
        .map(String);
      if (bits.length > 0) {
        return {
          text: bits.join(" | ").slice(0, 2000),
          code: Number.isFinite(Number(error.code)) ? Number(error.code) : null,
        };
      }
    }
  }
  const serialized = JSON.stringify(body);
  return { text: (serialized ?? String(body)).slice(0, 2000), code: null };
}

/** Sends one approved template attempt. Campaign retry/idempotency lives in whatsappDigest.ts. */
export async function sendWhatsappTemplate(
  input: WhatsappTemplateInput,
  fetchImpl: FetchLike = fetch,
): Promise<WhatsappTemplateSendResult> {
  let config: ReturnType<typeof graphConfig>;
  try {
    config = graphConfig();
  } catch (error) {
    return { ok: false, kind: "fatal", error: error instanceof Error ? error.message : String(error) };
  }
  if (!config) {
    return {
      ok: false,
      kind: "fatal",
      error: "WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_GRAPH_API_VERSION are required",
    };
  }

  const payload = buildWhatsappTemplatePayload(input);
  try {
    const response = await fetchImpl(
      `https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const rawBody = await response.text();
    let body: {
      messages?: Array<{ id?: string }>;
      error?: { message?: string; code?: number; error_subcode?: number };
      raw?: string;
    };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      body = { raw: rawBody };
    }
    if (response.ok) {
      const providerMessageId = body.messages?.[0]?.id;
      if (!providerMessageId) {
        return { ok: false, kind: "unknown", status: response.status, error: "Meta accepted the request without a message ID" };
      }
      return { ok: true, providerMessageId };
    }

    const details = errorDetails(body);
    if (response.status === 429 || response.status >= 500) {
      return { ok: false, kind: "retryable", status: response.status, error: details.text };
    }
    const isAuthFailure = response.status === 401 || response.status === 403 || [10, 190, 200].includes(details.code ?? -1);
    const isTemplateFailure =
      (details.code !== null && details.code >= 132000 && details.code <= 132999) ||
      details.text.toLowerCase().includes("template");
    if (isAuthFailure || isTemplateFailure) {
      return { ok: false, kind: "fatal", status: response.status, error: details.text };
    }
    return { ok: false, kind: "rejected", status: response.status, error: details.text };
  } catch (error) {
    // A network failure can happen after Meta accepted the request. Retrying it
    // would risk a duplicate marketing message, so the caller records unknown.
    return { ok: false, kind: "unknown", error: error instanceof Error ? error.message : String(error) };
  }
}

/** Sends a free-form reply inside the user-opened 24-hour service window. */
export async function sendWhatsappText(to: string, body: string): Promise<boolean> {
  let config: ReturnType<typeof graphConfig>;
  try {
    config = graphConfig();
  } catch (error) {
    console.error("sendWhatsappText: invalid configuration", error);
    return false;
  }
  if (!config) return false;

  try {
    const res = await fetch(`https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientDigits(to),
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
