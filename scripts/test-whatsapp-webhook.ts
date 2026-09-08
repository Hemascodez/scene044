/**
 * The webhook must parse the exact message shape AlertsBanner.tsx builds for
 * its wa.me link, reply with the sender's own name, and reject anything not
 * genuinely signed by Meta — a forged POST to a guessed URL must not be able
 * to write subscriber rows or trigger outbound sends.
 */
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { pool, query } from "../lib/db";
import { GET, POST } from "../app/api/whatsapp/webhook/route";
import { runWhatsappDigest } from "../lib/whatsappDigest";
import {
  categoriesFromMessage,
  isWhatsappStop,
  isValidSignature,
  parseField,
  replyFor,
  whatsappMessageText,
} from "../lib/whatsappWebhook";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

const REAL_MESSAGE = `Hi Scene, I'd like to receive Chennai event alerts.

Name: Priya
I'm a: Student
Interested in: Artificial Intelligence, Design and UX`;

check("parseField extracts Name", parseField(REAL_MESSAGE, "Name"), "Priya");
check("parseField extracts Interested in", parseField(REAL_MESSAGE, "Interested in"), "Artificial Intelligence, Design and UX");
check("parseField returns null for an absent label", parseField(REAL_MESSAGE, "Nonexistent"), null);

check(
  "categoriesFromMessage maps known interests",
  categoriesFromMessage(REAL_MESSAGE).sort(),
  ["ai", "design"],
);
check(
  "categoriesFromMessage: 'Not specified' -> no categories",
  categoriesFromMessage("Interested in: Not specified"),
  [],
);
check(
  "categoriesFromMessage: 'All events' -> no categories (empty already means everything)",
  categoriesFromMessage("Interested in: All events"),
  [],
);
check("categoriesFromMessage: no Interested in line at all", categoriesFromMessage("just a random message"), []);

check("replyFor greets the sender by their parsed name", replyFor(REAL_MESSAGE).includes("Hey Priya!"), true);
check(
  "replyFor mirrors back their stated interests",
  replyFor(REAL_MESSAGE).includes("noted you're into Artificial Intelligence, Design and UX"),
  true,
);
check(
  "replyFor falls back to 'there' when name is 'Not provided'",
  replyFor("Name: Not provided\nInterested in: Not specified").includes("Hey there!"),
  true,
);
check(
  "replyFor falls back to a generic clause when interests are 'Not specified'",
  replyFor("Name: Not provided\nInterested in: Not specified").includes("got you noted"),
  true,
);
check(
  "replyFor falls back to 'there' when there is no Name line at all",
  replyFor("gibberish, no fields here").includes("Hey there!"),
  true,
);
check(
  "replyFor falls back to a generic clause when there is no Interested in line at all",
  replyFor("gibberish, no fields here").includes("got you noted"),
  true,
);
check("STOP is recognized case-insensitively", isWhatsappStop(" Stop. "), true);
check("Stop updates payload is recognized", isWhatsappStop("stop_updates"), true);
check(
  "quick-reply button payload is extracted",
  whatsappMessageText({ type: "button", button: { payload: "Stop updates", text: "Stop updates" } }),
  "Stop updates",
);

function signedPost(payload: unknown): NextRequest {
  const raw = JSON.stringify(payload);
  const signature = `sha256=${crypto.createHmac("sha256", "test-app-secret").update(raw).digest("hex")}`;
  return new NextRequest("https://scene044.in/api/whatsapp/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": signature, "content-type": "application/json" },
    body: raw,
  });
}

async function main() {
  // This is a DB/webhook test, not a live Google Sheets test. A developer may
  // have production Sheets credentials in .env.local; remove them here so the
  // synthetic subscriber below can never reach the real spreadsheet.
  delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  delete process.env.GOOGLE_SHEETS_TAB_NAME;
  delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_GRAPH_API_VERSION;

  process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  const body = JSON.stringify({ hello: "world" });
  const validSig = `sha256=${crypto.createHmac("sha256", "test-app-secret").update(body).digest("hex")}`;

  check("isValidSignature accepts a genuine signature", isValidSignature(body, validSig), true);
  check("isValidSignature rejects a tampered body", isValidSignature(body + "x", validSig), false);
  check("isValidSignature rejects a garbage signature", isValidSignature(body, "sha256=deadbeef"), false);
  check("isValidSignature rejects a missing signature", isValidSignature(body, null), false);
  delete process.env.WHATSAPP_APP_SECRET;
  check("isValidSignature rejects when no app secret is configured", isValidSignature(body, validSig), false);

  process.env.WHATSAPP_VERIFY_TOKEN = "my-verify-token";
  const okReq = new NextRequest(
    "https://scene044.in/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=my-verify-token&hub.challenge=echo-me",
  );
  const okRes = await GET(okReq);
  check("GET echoes hub.challenge on a matching verify token", await okRes.text(), "echo-me");
  check("GET responds 200 on a matching verify token", okRes.status, 200);

  const badReq = new NextRequest(
    "https://scene044.in/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=echo-me",
  );
  const badRes = await GET(badReq);
  check("GET rejects a wrong verify token", badRes.status, 403);
  delete process.env.WHATSAPP_VERIFY_TOKEN;

  // Full POST flow end-to-end against the real DB, no network egress: no
  // WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID is set locally, so sendWhatsappText
  // no-ops (returns false) rather than calling the real Graph API.
  process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  const testPhone = "919999999998";
  await query("DELETE FROM subscribers WHERE phone_e164 = $1", [`+${testPhone}`]);

  const payload = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: testPhone,
                  type: "text",
                  text: {
                    body: "Name: Kavya\nI'm a: Founder or entrepreneur\nInterested in: Startups and Founders",
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const postReq = signedPost(JSON.parse(payload));
  const postRes = await POST(postReq);
  check("POST acks with 200", postRes.status, 200);

  const { rows } = await query<{
    name: string | null; role: string | null; message: string | null;
    categories: string[]; status: string;
  }>(
    "SELECT name, role, message, categories, status FROM subscribers WHERE phone_e164 = $1",
    [`+${testPhone}`],
  );
  check("POST recorded exactly one subscriber row", rows.length, 1);
  check("recorded subscriber has the mapped category", rows[0]?.categories, ["startups"]);
  check("recorded subscriber is active", rows[0]?.status, "active");
  check("recorded subscriber has the parsed name", rows[0]?.name, "Kavya");
  check("recorded subscriber has the parsed role", rows[0]?.role, "Founder or entrepreneur");
  check(
    "recorded subscriber keeps the inbound message",
    rows[0]?.message,
    "Name: Kavya\nI'm a: Founder or entrepreneur\nInterested in: Startups and Founders",
  );

  const subscriberId = await query<{ id: number }>(
    "SELECT id FROM subscribers WHERE phone_e164 = $1",
    [`+${testPhone}`],
  ).then((result) => result.rows[0]?.id);
  if (!subscriberId) throw new Error("test subscriber was not created");

  const firstCampaignReservation = await query<{ id: number }>(
    `INSERT INTO subscriber_sends
       (subscriber_id, channel, template_name, provider, campaign_key, event_ids, status)
     VALUES ($1, 'whatsapp', 'scene044_weekly_digest', 'meta', 'whatsapp-weekly:test', '{}', 'queued')
     ON CONFLICT (subscriber_id, campaign_key) WHERE campaign_key IS NOT NULL
     DO NOTHING
     RETURNING id`,
    [subscriberId],
  );
  const duplicateCampaignReservation = await query<{ id: number }>(
    `INSERT INTO subscriber_sends
       (subscriber_id, channel, template_name, provider, campaign_key, event_ids, status)
     VALUES ($1, 'whatsapp', 'scene044_weekly_digest', 'meta', 'whatsapp-weekly:test', '{}', 'queued')
     ON CONFLICT (subscriber_id, campaign_key) WHERE campaign_key IS NOT NULL
     DO NOTHING
     RETURNING id`,
    [subscriberId],
  );
  check("first weekly campaign row is reserved", firstCampaignReservation.rows.length, 1);
  check("same subscriber/week campaign reservation is idempotent", duplicateCampaignReservation.rows.length, 0);

  await query("DELETE FROM events WHERE primary_source_url = $1", [
    "https://example.test/whatsapp-digest-integration",
  ]);
  const { rows: digestEvents } = await query<{ id: number }>(
    `INSERT INTO events
       (title, category, start_at, registration_deadline, is_online,
        primary_source_url, source_type, status)
     VALUES ('WhatsApp digest integration event', 'startups',
             '2099-01-08T12:30:00Z', '2099-01-07T13:30:00Z', true,
             'https://example.test/whatsapp-digest-integration', 'curator', 'live')
     RETURNING id`,
  );
  const digestEventId = digestEvents[0]?.id;
  if (!digestEventId) throw new Error("test digest event was not created");
  process.env.WHATSAPP_TEST_RECIPIENT = `+${testPhone}`;
  let actualTestRecipient = "";
  const digestResult = await runWhatsappDigest(
    "test",
    { now: new Date("2099-01-07T12:30:00Z") },
    {
      sendTemplate: async (input) => {
        actualTestRecipient = input.to;
        return { ok: true, providerMessageId: "wamid.webhook-test" };
      },
      sleep: async () => undefined,
    },
  );
  delete process.env.WHATSAPP_TEST_RECIPIENT;
  check("test mode sends exactly one accepted template", digestResult.accepted, 1);
  check("test mode targets only WHATSAPP_TEST_RECIPIENT", actualTestRecipient, `+${testPhone}`);
  check("test mode records its selected event", digestResult.previews[0]?.eventIds.includes(digestEventId), true);

  const testSend = await query<{ id: number; status: string; event_ids: number[] }>(
    "SELECT id, status, event_ids FROM subscriber_sends WHERE campaign_key = $1",
    [digestResult.campaignKey],
  ).then((result) => result.rows[0]);
  const testSendId = testSend?.id;
  if (!testSendId) throw new Error("test mode did not create a send ledger row");
  check("test mode ledger begins accepted", testSend.status, "accepted");
  check("test mode ledger stores event IDs", testSend.event_ids.includes(digestEventId), true);

  const deliveredRes = await POST(signedPost({
    entry: [{
      changes: [{
        value: {
          statuses: [{ id: "wamid.webhook-test", status: "delivered", timestamp: "1788957000" }],
        },
      }],
    }],
  }));
  check("delivery status callback acks with 200", deliveredRes.status, 200);
  let sendState = await query<{ status: string; delivered_at: Date | null }>(
    "SELECT status, delivered_at FROM subscriber_sends WHERE id = $1",
    [testSendId],
  ).then((result) => result.rows[0]);
  check("delivery callback advances the send to delivered", sendState?.status, "delivered");
  check("delivery callback stores delivered_at", sendState?.delivered_at instanceof Date, true);

  await POST(signedPost({
    entry: [{ changes: [{ value: { statuses: [{ id: "wamid.webhook-test", status: "sent", timestamp: "1788956990" }] } }] }],
  }));
  sendState = await query<{ status: string; delivered_at: Date | null }>(
    "SELECT status, delivered_at FROM subscriber_sends WHERE id = $1",
    [testSendId],
  ).then((result) => result.rows[0]);
  check("replayed older sent callback cannot regress delivered", sendState?.status, "delivered");

  await POST(signedPost({
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: testPhone,
            type: "interactive",
            interactive: { button_reply: { id: "stop_updates", title: "Stop updates" } },
          }],
        },
      }],
    }],
  }));
  const unsubscribedStatus = await query<{ status: string; unsubscribed_at: Date | null }>(
    "SELECT status, unsubscribed_at FROM subscribers WHERE id = $1",
    [subscriberId],
  ).then((result) => result.rows[0]);
  check("quick-reply opt-out marks subscriber unsubscribed", unsubscribedStatus?.status, "unsubscribed");
  check("quick-reply opt-out stores unsubscribed_at", unsubscribedStatus?.unsubscribed_at instanceof Date, true);

  await query("DELETE FROM events WHERE id = $1", [digestEventId]);
  await query("DELETE FROM subscribers WHERE phone_e164 = $1", [`+${testPhone}`]);
  delete process.env.WHATSAPP_APP_SECRET;

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => pool.end());
