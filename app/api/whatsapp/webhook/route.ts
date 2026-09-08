import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { recordWhatsappOptIn } from "@/lib/subscribers";
import { sendWhatsappText } from "@/lib/whatsappSend";
import type { Category } from "@/lib/types";

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

/**
 * Best-effort label -> category mapping for the interests AlertsBanner.tsx
 * collects. Must stay in sync with its INTERESTS list. "All events" and
 * "Career and Networking" intentionally have no entry: an empty result
 * already means "everything" (see lib/subscribers.ts's sanitizeCategories),
 * and there is no category to narrow "Career and Networking" to.
 */
const INTEREST_TO_CATEGORIES: Record<string, Category[]> = {
  "Artificial Intelligence": ["ai"],
  "Software Development": ["tech"],
  "Design and UX": ["design"],
  Marketing: ["marketing"],
  Cybersecurity: ["cybersecurity"],
  Data: ["data"],
  "Startups and Founders": ["startups"],
  Product: ["product"],
};

/** Pulls "Label: value" out of a multi-line message. Case-insensitive and
 *  anchored per-line since WhatsApp messages arrive with real newlines. */
export function parseField(text: string, label: string): string | null {
  const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  return match ? match[1].trim() : null;
}

export function categoriesFromMessage(text: string): Category[] {
  const raw = parseField(text, "Interested in");
  if (!raw || raw === "Not specified") return [];
  const categories = new Set<Category>();
  for (const label of raw.split(",").map((s) => s.trim())) {
    for (const c of INTEREST_TO_CATEGORIES[label] ?? []) categories.add(c);
  }
  return [...categories];
}

export function replyFor(text: string): string {
  const name = parseField(text, "Name");
  const greetingName = name && name !== "Not provided" ? name : "there";
  return `Hey ${greetingName}! 🎉 Thanks for registering with SCENE/044 — got your interests noted. We'll send you Chennai tech event updates every week. Talk soon!`;
}

/** True when `signature` (the request's X-Hub-Signature-256 header) is a
 *  valid HMAC-SHA256 of the raw body under the app secret — proves the
 *  request actually came from Meta, not an arbitrary POST to a guessed URL. */
export function isValidSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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

          await recordWhatsappOptIn({ phone: from, categories: categoriesFromMessage(body) });
          await sendWhatsappText(from, replyFor(body));
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
