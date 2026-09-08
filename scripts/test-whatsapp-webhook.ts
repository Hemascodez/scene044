/**
 * The webhook must parse the exact message shape AlertsBanner.tsx builds for
 * its wa.me link, reply with the sender's own name, and reject anything not
 * genuinely signed by Meta — a forged POST to a guessed URL must not be able
 * to write subscriber rows or trigger outbound sends.
 */
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { pool, query } from "../lib/db";
import { categoriesFromMessage, GET, isValidSignature, parseField, POST, replyFor } from "../app/api/whatsapp/webhook/route";

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
  "replyFor falls back to 'there' when name is 'Not provided'",
  replyFor("Name: Not provided\nInterested in: Not specified").includes("Hey there!"),
  true,
);
check(
  "replyFor falls back to 'there' when there is no Name line at all",
  replyFor("gibberish, no fields here").includes("Hey there!"),
  true,
);

async function main() {
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
  const sig = `sha256=${crypto.createHmac("sha256", "test-app-secret").update(payload).digest("hex")}`;

  const postReq = new NextRequest("https://scene044.in/api/whatsapp/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": sig, "content-type": "application/json" },
    body: payload,
  });
  const postRes = await POST(postReq);
  check("POST acks with 200", postRes.status, 200);

  const { rows } = await query<{ categories: string[]; status: string }>(
    "SELECT categories, status FROM subscribers WHERE phone_e164 = $1",
    [`+${testPhone}`],
  );
  check("POST recorded exactly one subscriber row", rows.length, 1);
  check("recorded subscriber has the mapped category", rows[0]?.categories, ["startups"]);
  check("recorded subscriber is active", rows[0]?.status, "active");

  await query("DELETE FROM subscribers WHERE phone_e164 = $1", [`+${testPhone}`]);
  delete process.env.WHATSAPP_APP_SECRET;

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => pool.end());
