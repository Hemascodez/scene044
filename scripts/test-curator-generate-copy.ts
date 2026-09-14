/**
 * The "Ask AI to draft this" route for curator-entered events.
 *
 * The one thing worth locking down here isn't the AI output itself (that's
 * lib/summarize.ts's job, already tested) — it's that this route enforces the
 * one real precondition before spending a model call: there has to be source
 * text to ground the copy in. A curator with only a title and no description
 * should get told to paste something in, not a confidently-invented summary.
 */
import { NextRequest } from "next/server";
import { POST } from "../app/api/admin/curator/generate-copy/route";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

const AUTH = `Basic ${Buffer.from(`:${process.env.CURATOR_PASSWORD}`).toString("base64")}`;

function post(body: unknown): NextRequest {
  return new NextRequest("https://scene044.in/api/admin/curator/generate-copy", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: AUTH },
    body: JSON.stringify(body),
  });
}

async function main() {
  console.log("--- auth ---");
  check(
    "an unauthenticated request is rejected",
    (await POST(new NextRequest("https://scene044.in/api/admin/curator/generate-copy", {
      method: "POST",
      body: JSON.stringify({ title: "x", sourceText: "y" }),
    }))).status,
    401,
  );

  console.log("\n--- validation, before any model call ---");
  check("missing title is rejected", (await POST(post({ sourceText: "A workshop on RAG." }))).status, 400);
  check(
    "missing source text is rejected — nothing to ground the copy in",
    (await POST(post({ title: "AI Meetup" }))).status,
    400,
  );
  check(
    "an unknown category is rejected before it reaches the model",
    (await POST(post({ title: "AI Meetup", sourceText: "A talk.", category: "not-a-real-category" }))).status,
    400,
  );
  check(
    "an invalid priceType is rejected",
    (await POST(post({ title: "AI Meetup", sourceText: "A talk.", priceType: "expensive" }))).status,
    400,
  );
  check(
    "invalid JSON is rejected, not a 500",
    (await POST(new NextRequest("https://scene044.in/api/admin/curator/generate-copy", {
      method: "POST",
      headers: { authorization: AUTH },
      body: "{not json",
    }))).status,
    400,
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
