import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { recordWhatsappOptIn } from "@/lib/subscribers";
import { upsertWhatsappSubscriberInGoogleSheet } from "@/lib/googleSheets";
import { sendWhatsappText } from "@/lib/whatsappSend";
import {
  categoriesFromMessage,
  isValidSignature,
  parseField,
  replyFor,
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
        const messages = (value?.messages ?? []) as Record<string, unknown>[];
        for (const message of messages) {
          if (message.type !== "text") continue;
          const from = String(message.from ?? "");
          const body = String((message.text as { body?: string } | undefined)?.body ?? "");
          if (!from || !body) continue;

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
            ? upsertWhatsappSubscriberInGoogleSheet({
                phone: optIn.subscriber.phone,
                name: optIn.subscriber.name,
                role: optIn.subscriber.role,
                categories: optIn.subscriber.categories,
                message: optIn.subscriber.message,
                consentNote: optIn.subscriber.consentNote,
                status: optIn.subscriber.status,
                subscribedAt: optIn.subscriber.createdAt,
              }).catch((error: unknown) => {
                console.error("whatsapp webhook: Google Sheets sync failed", error);
                return false;
              })
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
