import {
  META_TEMPLATE_BODY_LIMIT,
  buildDigestEventBlock,
  categoryMatches,
  digestTemplateInput,
  formatDigestEvent,
  isEventInDigestWindow,
  selectDigestEvents,
  sendWhatsappTemplateWithRetries,
  runWhatsappDigest,
  weeklyCampaignKey,
  type DigestEvent,
} from "../lib/whatsappDigest";
import { normalizePhoneE164 } from "../lib/subscribers";
import { buildWhatsappTemplatePayload, sendWhatsappTemplate } from "../lib/whatsappSend";
import { isWhatsappStop, whatsappMessageText } from "../lib/whatsappWebhook";

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

function event(
  id: number,
  category: DigestEvent["category"],
  startAt: string,
  deadline: string | null = null,
  title = `Event ${id}`,
): DigestEvent {
  return {
    id,
    title,
    category,
    startAt: new Date(startAt),
    registrationDeadline: deadline ? new Date(deadline) : null,
    isOnline: id % 2 === 0,
    venueName: id % 2 === 0 ? null : "Taramani",
    venueAddress: null,
  };
}

async function main() {
  const now = new Date("2026-09-09T12:30:00.000Z"); // Wednesday, 6 PM IST
  check("campaign key uses the IST Monday", weeklyCampaignKey(now), "whatsapp-weekly:2026-09-07");
  check(
    "campaign key changes exactly at IST Monday midnight",
    [weeklyCampaignKey(new Date("2026-09-06T18:29:59.000Z")), weeklyCampaignKey(new Date("2026-09-06T18:30:00.000Z"))],
    ["whatsapp-weekly:2026-08-31", "whatsapp-weekly:2026-09-07"],
  );

  check("window includes its start", isEventInDigestWindow(new Date(now), now), true);
  check("window excludes its exact seven-day end", isEventInDigestWindow(new Date("2026-09-16T12:30:00.000Z"), now), false);
  check("window includes one millisecond before its end", isEventInDigestWindow(new Date("2026-09-16T12:29:59.999Z"), now), true);

  check("empty categories match every event", categoryMatches([], "finance"), true);
  check("selected category matches", categoryMatches(["ai", "design"], "ai"), true);
  check("unselected category does not match", categoryMatches(["design"], "ai"), false);

  const candidates = [
    event(1, "ai", "2026-09-10T12:30:00Z", null),
    event(2, "design", "2026-09-11T12:30:00Z", "2026-09-10T00:00:00Z"),
    event(3, "ai", "2026-09-12T12:30:00Z", "2026-09-09T18:00:00Z"),
    event(4, "ai", "2026-09-13T12:30:00Z", "2026-09-09T18:00:00Z"),
    event(5, "ai", "2026-09-14T12:30:00Z", null),
    event(6, "ai", "2026-09-15T12:30:00Z", null),
  ];
  check(
    "deadline ranks first, then event date, and selection stops at five",
    selectDigestEvents(candidates, []).map((item) => item.id),
    [3, 4, 2, 1, 5],
  );
  check(
    "category filtering and once-only exclusion apply together",
    selectDigestEvents(candidates, ["ai"], new Set([3, 4])).map((item) => item.id),
    [1, 5, 6],
  );
  check("zero category matches skips the digest", selectDigestEvents(candidates, ["marketing"]), []);

  const formatted = formatDigestEvent(candidates[1]);
  check("event formatter renders a bullet and title", formatted.startsWith("• Event 2 — "), true);
  check("online event formatter ends with Online", formatted.endsWith(" — Online"), true);
  check("venue event formatter ends with venue", formatDigestEvent(candidates[0]).endsWith(" — Taramani"), true);

  const longEvents = [1, 2, 3, 4, 5].map((id) =>
    event(id, "ai", `2026-09-${9 + id}T12:30:00Z`, null, `🚀 ${"Very long title ".repeat(30)} ${id}`),
  );
  const block = buildDigestEventBlock(longEvents, "Hema", "AI & Machine Learning");
  const rendered = `Hi Hema, here are your Chennai tech picks for this week:\n\n${block}\n\nSee more AI & Machine Learning events using the button below.\n\nYou subscribed to SCENE/044 updates. Reply STOP to unsubscribe.`;
  check("all five events remain represented after truncation", block.split("\n").length, 5);
  check("every digest event is a bullet", block.split("\n").every((line) => line.startsWith("• ")), true);
  check("rendered body respects Meta's 1024-character limit", Array.from(rendered).length <= META_TEMPLATE_BODY_LIMIT, true);
  check("unicode truncation does not create replacement characters", block.includes("�"), false);

  const input = digestTemplateInput({
    to: "+91 98765 43210",
    subscriberName: null,
    events: candidates.slice(0, 2),
    campaignKey: weeklyCampaignKey(now),
    subscriberId: 42,
  });
  const payload = buildWhatsappTemplatePayload(input);
  check("template defaults to scene044_weekly_digest", payload.template.name, "scene044_weekly_digest");
  check("template defaults to en_US", payload.template.language.code, "en_US");
  check("template has the three approved body variables", payload.template.components[0]?.parameters.length, 3);
  check("template falls back to there", payload.template.components[0]?.parameters[0]?.text, "there");
  check("template names the destination category", payload.template.components[0]?.parameters[2]?.text, "AI & Machine Learning");
  const button = payload.template.components[1];
  check("template includes a dynamic URL button", button?.type, "button");
  check("URL button targets the AI category suffix", button?.parameters[0]?.text, "ai");
  check("Cloud API phone is normalized to digits", payload.to, "919876543210");
  check("Indian domestic phone normalization works", normalizePhoneE164("98765 43210"), "+919876543210");
  check("invalid phone normalization is rejected", normalizePhoneE164("123"), null);

  const productInput = digestTemplateInput({
    to: "+919876543210",
    subscriberName: "Hema",
    subscriberCategories: ["product"],
    events: [candidates[0]],
    campaignKey: weeklyCampaignKey(now),
    subscriberId: 43,
  });
  check("Product subscribers use the combined product-design page", productInput.urlButtonSuffix, "product-design");

  let attempts = 0;
  const retried = await sendWhatsappTemplateWithRetries({
    input,
    sendTemplate: async () => {
      attempts++;
      return attempts < 3
        ? { ok: false as const, kind: "retryable" as const, status: 429, error: "rate limited" }
        : { ok: true as const, providerMessageId: "wamid.test" };
    },
    sleep: async () => undefined,
  });
  check("explicit 429/5xx responses retry up to three attempts", attempts, 3);
  check("retry sequence can finish accepted", retried.ok, true);

  attempts = 0;
  const uncertain = await sendWhatsappTemplateWithRetries({
    input,
    sendTemplate: async () => {
      attempts++;
      return { ok: false as const, kind: "unknown" as const, error: "socket closed" };
    },
    sleep: async () => undefined,
  });
  check("uncertain requests are never retried", attempts, 1);
  check("uncertain request remains unknown", uncertain.ok ? "ok" : uncertain.kind, "unknown");

  const oldToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const oldPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const oldVersion = process.env.WHATSAPP_GRAPH_API_VERSION;
  process.env.WHATSAPP_ACCESS_TOKEN = "unit-test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v99.0";
  const authFailure = await sendWhatsappTemplate(input, async () =>
    new Response(JSON.stringify({ error: { message: "Invalid OAuth access token", code: 190 } }), { status: 401 }),
  );
  check("authentication rejection is campaign-fatal", authFailure.ok ? "ok" : authFailure.kind, "fatal");
  const recipientFailure = await sendWhatsappTemplate(input, async () =>
    new Response(JSON.stringify({ error: { message: "Recipient is not valid", code: 131030 } }), { status: 400 }),
  );
  check("recipient-specific 400 does not abort the campaign", recipientFailure.ok ? "ok" : recipientFailure.kind, "rejected");
  const templateFailure = await sendWhatsappTemplate(input, async () =>
    new Response(JSON.stringify({ error: { message: "Template not found", code: 132001 } }), { status: 400 }),
  );
  check("template configuration rejection is campaign-fatal", templateFailure.ok ? "ok" : templateFailure.kind, "fatal");
  if (oldToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
  else process.env.WHATSAPP_ACCESS_TOKEN = oldToken;
  if (oldPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  else process.env.WHATSAPP_PHONE_NUMBER_ID = oldPhoneId;
  if (oldVersion === undefined) delete process.env.WHATSAPP_GRAPH_API_VERSION;
  else process.env.WHATSAPP_GRAPH_API_VERSION = oldVersion;

  check("STOP is recognized case-insensitively", isWhatsappStop(" Stop. "), true);
  check("Stop updates quick-reply payload is recognized", isWhatsappStop("stop_updates"), true);
  check("normal conversation is not an opt-out", isWhatsappStop("show updates"), false);
  check(
    "interactive quick-reply payload is extracted",
    whatsappMessageText({ type: "interactive", interactive: { button_reply: { id: "stop_updates", title: "Stop updates" } } }),
    "stop_updates",
  );

  const oldDigestEnabled = process.env.WHATSAPP_DIGEST_ENABLED;
  delete process.env.WHATSAPP_DIGEST_ENABLED;
  let disabledError = "";
  try {
    await runWhatsappDigest("production", {}, {
      sendTemplate: async () => ({ ok: true, providerMessageId: "must-not-send" }),
    });
  } catch (error) {
    disabledError = error instanceof Error ? error.message : String(error);
  }
  check("production cannot send while the kill switch is off", disabledError.includes("disabled"), true);
  if (oldDigestEnabled === undefined) delete process.env.WHATSAPP_DIGEST_ENABLED;
  else process.env.WHATSAPP_DIGEST_ENABLED = oldDigestEnabled;

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
