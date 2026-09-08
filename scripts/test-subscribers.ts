/**
 * Subscriber storage, consent and validation.
 *
 * Uses @scene044-test.invalid addresses (.invalid is reserved by RFC 2606 and
 * can never be a real domain) and cleans up after itself.
 */
import { query } from "../lib/db";
import {
  isPlausibleEmail, normalizeEmail, normalizePhoneE164, sanitizeCategories,
  subscribeEmail, unsubscribeByToken, recordWhatsappOptIn,
} from "../lib/subscribers";
import { buildWhatsappOptInLink } from "../lib/whatsappLink";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

async function main() {
  console.log("--- email validation ---");
  check("normalizes case + whitespace", normalizeEmail("  Hema@Example.COM "), "hema@example.com");
  check("keeps +tag (not our call to strip)", normalizeEmail("a+scene@gmail.com"), "a+scene@gmail.com");
  check("accepts ordinary address", isPlausibleEmail("hema@example.com"), true);
  check("accepts long TLD", isPlausibleEmail("a@b.technology"), true);
  check("rejects no @", isPlausibleEmail("hemaexample.com"), false);
  check("rejects two @", isPlausibleEmail("a@b@c.com"), false);
  check("rejects no dot in domain", isPlausibleEmail("hema@localhost"), false);
  check("rejects embedded space", isPlausibleEmail("he ma@example.com"), false);
  check("rejects trailing dot", isPlausibleEmail("a@b.com."), false);
  check("rejects double dot", isPlausibleEmail("a@b..com"), false);
  check("rejects empty local part", isPlausibleEmail("@example.com"), false);
  check("rejects over-long address", isPlausibleEmail("a".repeat(250) + "@example.com"), false);

  console.log("\n--- phone normalisation (webhook path only) ---");
  check("bare 10-digit -> +91", normalizePhoneE164("9876543210"), "+919876543210");
  check("0-prefixed domestic", normalizePhoneE164("09876543210"), "+919876543210");
  check("already +91", normalizePhoneE164("+91 98765 43210"), "+919876543210");
  check("dashes and spaces", normalizePhoneE164("+91-98765-43210"), "+919876543210");
  check("91-prefixed no plus", normalizePhoneE164("919876543210"), "+919876543210");
  check("rejects junk", normalizePhoneE164("hello"), null);
  check("rejects too short", normalizePhoneE164("12345"), null);

  console.log("\n--- category allowlist ---");
  check("keeps valid", sanitizeCategories(["ai", "design"]), ["ai", "design"]);
  check("drops unknown", sanitizeCategories(["ai", "crypto", "sports"]), ["ai"]);
  check("dedupes", sanitizeCategories(["ai", "ai"]), ["ai"]);
  check("non-array -> empty", sanitizeCategories("ai"), []);
  check("rejects injection attempt", sanitizeCategories(["ai'; DROP TABLE subscribers;--"]), []);

  console.log("\n--- storage round-trip ---");
  const email = "roundtrip@scene044-test.invalid";
  await query("DELETE FROM subscribers WHERE email LIKE '%@scene044-test.invalid'");

  const first = await subscribeEmail({ email, categories: ["ai"], source: "test" });
  check("first signup creates row", first.created, true);

  const second = await subscribeEmail({ email: "  RoundTrip@Scene044-Test.INVALID  ".trim().toLowerCase(), categories: ["design", "startups"], source: "test" });
  check("repeat signup is an update, not a duplicate", second.created, false);
  check("token is stable across re-signup", second.unsubscribeToken, first.unsubscribeToken);

  const { rows: after } = await query<{ categories: string[]; status: string; n: string }>(
    "SELECT categories, status, count(*) OVER ()::text AS n FROM subscribers WHERE email = $1", [email]);
  check("only one row exists", after[0].n, "1");
  check("categories were updated", after[0].categories, ["design", "startups"]);

  check("unsubscribe succeeds", await unsubscribeByToken(first.unsubscribeToken), true);
  const { rows: unsub } = await query<{ status: string }>("SELECT status FROM subscribers WHERE email = $1", [email]);
  check("status is unsubscribed", unsub[0].status, "unsubscribed");

  check("unknown token is a no-op, not an error", await unsubscribeByToken("0".repeat(48)), false);
  check("empty token rejected", await unsubscribeByToken(""), false);

  const resub = await subscribeEmail({ email, categories: [], source: "test" });
  check("re-signup reactivates", resub.created, false);
  const { rows: re } = await query<{ status: string }>("SELECT status FROM subscribers WHERE email = $1", [email]);
  check("status back to active", re[0].status, "active");

  console.log("\n--- whatsapp opt-in (webhook path) ---");
  await query("DELETE FROM subscribers WHERE phone_e164 = '+919999900001'");
  const wa = await recordWhatsappOptIn({
    phone: "+91 99999 00001",
    name: "Kavya",
    role: "Founder",
    message: "Name: Kavya\nI'm a: Founder",
    categories: ["startups"],
  });
  check("inbound message creates subscriber", wa.ok && wa.created, true);
  const waAgain = await recordWhatsappOptIn({ phone: "9999900001" });
  check("same number is idempotent", waAgain.ok && !waAgain.created, true);
  const bad = await recordWhatsappOptIn({ phone: "nope" });
  check("unparseable phone rejected", bad.ok, false);
  const { rows: waRows } = await query<{
    name: string | null; role: string | null; message: string | null; categories: string[];
  }>("SELECT name, role, message, categories FROM subscribers WHERE phone_e164 = '+919999900001'");
  check("WhatsApp name is stored", waRows[0]?.name, "Kavya");
  check("WhatsApp role is stored", waRows[0]?.role, "Founder");
  check("WhatsApp message is stored", waRows[0]?.message, "Name: Kavya\nI'm a: Founder");
  check("empty repeat message does not erase categories", waRows[0]?.categories, ["startups"]);

  await recordWhatsappOptIn({
    phone: "9999900001",
    categories: [],
    replaceCategories: true,
  });
  const { rows: allEventsRows } = await query<{ categories: string[] }>(
    "SELECT categories FROM subscribers WHERE phone_e164 = '+919999900001'",
  );
  check("explicit All events selection clears prior categories", allEventsRows[0]?.categories, []);

  console.log("\n--- wa.me link ---");
  const noNumber = { ...process.env };
  delete process.env.WHATSAPP_BUSINESS_NUMBER;
  check("no number configured -> null (hide the option)", buildWhatsappOptInLink(), null);
  process.env.WHATSAPP_BUSINESS_NUMBER = "+91 98765 43210";
  const link = buildWhatsappOptInLink();
  check("builds digits-only wa.me link", link?.href.startsWith("https://wa.me/919876543210?text="), true);
  check("message is url-encoded", link?.href.includes("SCENE%2F044"), true);
  process.env.WHATSAPP_BUSINESS_NUMBER = "12345";
  check("too-short number -> null", buildWhatsappOptInLink(), null);
  process.env = noNumber;

  await query("DELETE FROM subscribers WHERE email LIKE '%@scene044-test.invalid' OR phone_e164 = '+919999900001'");
  const { rows: left } = await query<{ n: string }>("SELECT count(*)::text AS n FROM subscribers");
  console.log(`\ncleanup: ${left[0].n} subscriber rows remain`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
