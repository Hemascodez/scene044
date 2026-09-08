import crypto from "node:crypto";
import type { Category } from "@/lib/types";

/** Maps the visitor-facing interest labels to the feed's stored categories. */
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

/** Pulls "Label: value" from a multi-line WhatsApp message. */
export function parseField(text: string, label: string): string | null {
  const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  return match ? match[1].trim() : null;
}

export function categoriesFromMessage(text: string): Category[] {
  const raw = parseField(text, "Interested in");
  if (!raw || raw === "Not specified") return [];
  const categories = new Set<Category>();
  for (const label of raw.split(",").map((value) => value.trim())) {
    for (const category of INTEREST_TO_CATEGORIES[label] ?? []) categories.add(category);
  }
  return [...categories];
}

export function replyFor(text: string): string {
  const name = parseField(text, "Name");
  const greetingName = name && name !== "Not provided" ? name : "there";

  const interests = parseField(text, "Interested in");
  const notedClause =
    interests && interests !== "Not specified" ? `noted you're into ${interests}` : "got you noted";

  return `Hey ${greetingName}! 🎉 Thanks for registering with SCENE/044 — ${notedClause}. We'll send you Chennai tech event updates every week. Talk soon!`;
}

/** STOP text and Meta's quick-reply title/payload share this path. */
export function isWhatsappStop(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[.!]+$/g, "")
    .replace(/\s+/g, " ");
  return normalized === "stop" || normalized === "stop updates";
}

/** Extracts text from plain messages and both generations of quick replies. */
export function whatsappMessageText(message: Record<string, unknown>): string {
  if (message.type === "text") {
    return String((message.text as { body?: unknown } | undefined)?.body ?? "").trim();
  }
  if (message.type === "button") {
    const button = message.button as { payload?: unknown; text?: unknown } | undefined;
    return String(button?.payload ?? button?.text ?? "").trim();
  }
  if (message.type === "interactive") {
    const interactive = message.interactive as {
      button_reply?: { id?: unknown; title?: unknown };
    } | undefined;
    return String(interactive?.button_reply?.id ?? interactive?.button_reply?.title ?? "").trim();
  }
  return "";
}

/** Verifies that an inbound webhook body was signed by Meta. */
export function isValidSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
