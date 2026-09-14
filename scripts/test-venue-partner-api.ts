/**
 * The public partner-request route.
 *
 * This exists because the "list your venue" form's submit handler used to call
 * only `setSent(true)` — every real venue lead was silently discarded. The one
 * thing this test suite must prove is that a POST here actually lands a row the
 * curator can see, and that obviously-bad input is rejected before it does.
 */
import { NextRequest } from "next/server";
import { pool, query } from "../lib/db";
import { POST } from "../app/api/venues/partner-requests/route";
import { listPartnerRequests } from "../lib/venueCatalog";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

const MARKER = "PartnerApiTest";

function post(body: unknown): NextRequest {
  return new NextRequest("https://scene044.in/api/venues/partner-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function cleanup() {
  await query("DELETE FROM venue_partner_requests WHERE venue_name LIKE $1", [`${MARKER}%`]);
}

async function main() {
  await cleanup();

  console.log("--- the actual bug: a submission must survive ---");
  const good = {
    name: "Priya Owner",
    phone: "+919876543210",
    venue: `${MARKER} Rooftop`,
    area: "Adyar",
    link: "https://instagram.com/example",
    details: "A rooftop that seats 40, with power points and decent wifi.",
  };
  const res = await POST(post(good));
  check("a valid submission is accepted", res.status, 200);
  const body = await res.json();
  check("the response confirms ok", body.ok, true);
  check("an id is returned", typeof body.id, "number");

  const stored = await listPartnerRequests();
  const found = stored.find((r) => r.venueName === good.venue);
  check("the submission actually reached the database", !!found, true);
  check("it starts in the new queue", found?.status, "new");
  check("the contact phone is stored", found?.phone, good.phone);

  console.log("\n--- validation ---");
  check("missing required fields are rejected", (await POST(post({ name: "X" }))).status, 400);
  check(
    "a non-http(s) link is rejected",
    (await POST(post({ ...good, venue: `${MARKER} Bad Link`, link: "javascript:alert(1)" }))).status,
    400,
  );
  check("invalid JSON is rejected, not a 500", (await POST(new NextRequest("https://scene044.in/api/venues/partner-requests", { method: "POST", body: "{not json" }))).status, 400);

  const withoutLink = { ...good, venue: `${MARKER} No Link`, link: undefined };
  check("link is optional", (await POST(post(withoutLink))).status, 200);

  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => pool.end());
