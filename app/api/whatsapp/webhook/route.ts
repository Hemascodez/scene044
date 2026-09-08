import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  recordWhatsappOptIn,
  unsubscribeWhatsappByPhone,
  type WhatsappSubscriber,
} from "@/lib/subscribers";
import { upsertWhatsappSubscriberInGoogleSheet } from "@/lib/googleSheets";
import {
  recordWhatsappDeliveryStatus,
  type DeliveryStatus,
} from "@/lib/whatsappDigest";
import { sendWhatsappText } from "@/lib/whatsappSend";
import {
  categoriesFromMessage,
  isWhatsappStop,
  isValidSignature,
  parseField,
  replyFor,
  whatsappMessageText,
} from "@/lib/whatsappWebhook";

/**
 * Receives inbound WhatsApp messages via Meta's Cloud API, records the
 * sender as a subscriber (lib/subscribers.ts's recordWhatsappOptIn — already
 * built, never had a webhook to call it from), and replies with a
 * personalized confirmation.
 *
 * The incoming message is expected to be the exact format
 * components/scene/AlertsBanner.tsx builds for its wa.me opt-in link:
 *   Name: X
 *   I'm a: Y
 *   Interested in: A, B, C
 * A message that doesn't match still gets recorded and a generic reply —
 * this is a discovery inbox, not a form validator.
 */

/** Meta's verification handshake, sent once when the Callback URL is saved
 *  in the developer dashboard. Must echo hub.challenge back as plain text —
 *  anything else, including JSON, fails verification. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && challenge && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

function optionalMessageField(text: string, label: string, placeholder: string): string | null {
  const value = parseField(text, label);
  return value && value !== placeholder ? value : null;
}

function syncSubscriberToSheet(subscriber: WhatsappSubscriber): Promise<boolean> {
  return upsertWhatsappSubscriberInGoogleSheet({
    phone: subscriber.phone,
    name: subscriber.name,
    role: subscriber.role,
    categories: subscriber.categories,
    message: subscriber.message,
    consentNote: subscriber.consentNote,
    status: subscriber.status,
    subscribedAt: subscriber.createdAt,
  }).catch((error: unknown) => {
    console.error("whatsapp webhook: Google Sheets sync failed", error);
    return false;
  });
}

const DELIVERY_STATUSES = new Set<DeliveryStatus>([
  "accepted",
  "sent",
  "delivered",
  "read",
  "failed",
]);

function deliveryError(status: Record<string, unknown>): string | null {
  const errors = Array.isArray(status.errors) ? status.errors : [];
  if (errors.length === 0) return null;
  return errors
    .map((item) => {
      const error = item as {
        code?: unknown;
        title?: unknown;
        message?: unknown;
        error_data?: { details?: unknown };
      };
      return [error.code, error.title, error.message, error.error_data?.details]
        .filter((value) => value !== undefined && value !== null)
        .map(String)
        .join(" | ");
    })
    .filter(Boolean)
    .join("; ")
    .slice(0, 2000);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Nothing parseable to retry — ack so Meta doesn't resend it forever.
    return NextResponse.json({ ok: true });
  }

  try {
    const entries = ((payload as { entry?: unknown[] })?.entry ?? []) as Record<string, unknown>[];
    for (const entry of entries) {
      const changes = (entry.changes ?? []) as Record<string, unknown>[];
      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined;

        const statuses = (value?.statuses ?? []) as Record<string, unknown>[];
        for (const status of statuses) {
          const providerMessageId = String(status.id ?? "");
          const providerStatus = String(status.status ?? "") as DeliveryStatus;
          if (!providerMessageId || !DELIVERY_STATUSES.has(providerStatus)) continue;
          const timestampSeconds = Number(status.timestamp);
          const occurredAt = Number.isFinite(timestampSeconds)
            ? new Date(timestampSeconds * 1000)
            : undefined;
          await recordWhatsappDeliveryStatus({
            providerMessageId,
            status: providerStatus,
            occurredAt,
            error: deliveryError(status),
          });
        }

        const messages = (value?.messages ?? []) as Record<string, unknown>[];
        for (const message of messages) {
          const from = String(message.from ?? "");
          const body = whatsappMessageText(message);
          if (!from || !body) continue;

          // Opt-outs must run before the generic inbound-message upsert, which
          // otherwise reactivates an unsubscribed row by design.
          if (isWhatsappStop(body)) {
            const subscriber = await unsubscribeWhatsappByPhone(from);
            const confirmation = sendWhatsappText(
              from,
              "You've been unsubscribed from SCENE/044 WhatsApp updates. You won't receive future event digests.",
            );
            const sheetSync = subscriber ? syncSubscriberToSheet(subscriber) : Promise.resolve(false);
            await Promise.all([confirmation, sheetSync]);
            continue;
          }

          // Non-STOP button interactions are not subscription forms.
          if (message.type !== "text") continue;

          const optIn = await recordWhatsappOptIn({
            phone: from,
            name: optionalMessageField(body, "Name", "Not provided"),
            role: optionalMessageField(body, "I'm a", "Not specified"),
            message: body,
            categories: categoriesFromMessage(body),
            replaceCategories: parseField(body, "Interested in") !== null,
          });

          const replyPromise = sendWhatsappText(from, replyFor(body));
          const sheetPromise = optIn.ok
            ? syncSubscriberToSheet(optIn.subscriber)
            : Promise.resolve(false);

          await Promise.all([replyPromise, sheetPromise]);
        }
      }
    }
  } catch (err) {
    console.error("whatsapp webhook: failed to process payload", err);
  }

  // Meta requires 200 regardless of internal outcome, or it retries the same
  // event repeatedly.
  return NextResponse.json({ ok: true });
}
