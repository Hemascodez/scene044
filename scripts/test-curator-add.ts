import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { Pool } from "pg";
import { NextRequest } from "next/server";
import { POST } from "../app/api/admin/curator/add/route";
import { GET } from "../app/api/admin/events/route";
import { findCuratorAddTarget } from "../lib/curatorAddTarget";

async function main() {
  process.env.CURATOR_PASSWORD = "test-only-password";
  const headers = { Authorization: `Basic ${btoa("curator:test-only-password")}` };
  const url = "https://luma.com/00dhanbk";
  const fixture = { id: 7, title: "Existing event", url, status: "curator_pending", event_id: null,
    resolved_event_id: null, source_domain: "luma.com", curator_draft: { title: "Saved draft" } };
  let item: Record<string, unknown> | null = { ...fixture };
  let created = true;
  const statements: { sql: string; values?: unknown[] }[] = [];
  globalThis.__pgPool = { query: async (sql: string, values?: unknown[]) => {
    statements.push({ sql, values });
    if (sql.includes("INSERT INTO discovery_items")) {
      item = { ...fixture };
      return { rows: created ? [{ id: 7 }] : [] };
    }
    if (sql.includes("FROM discovery_items di")) return { rows: item ? [item] : [] };
    if (sql.includes("FROM events e")) return { rows: [{ id: 44, status: "expired" }] };
    throw new Error(`Unexpected query: ${sql}`);
  } } as unknown as Pool;
  const request = (body: unknown, authorized = true) => new Request("http://localhost/api/admin/curator/add", {
    method: "POST", body: JSON.stringify(body), headers: authorized ? headers : {},
  });
  assert.equal((await POST(request({ url }, false))).status, 401);
  for (const body of [null, {}, { url: 42 }, { url: "file:///etc/passwd" }, { url: "localhost" }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  for (const [status, queue] of Object.entries({ curator_pending: "pending", needs_correction: "needs_correction",
    expired: "expired", rejected: "rejected", curator_rejected: "rejected", needs_date_review: "needs_date_review",
    duplicate: "duplicates", error: "errors", new: "in_progress", auto_processing: "in_progress" })) {
    item = { ...fixture, status };
    const response = await POST(request({ url }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.reused, true);
    assert.equal(result.destination, "queue");
    assert.equal(result.queue, queue);
    assert.equal(result.item.id, 7);
    assert.deepEqual(result.item.curator_draft, fixture.curator_draft);
    assert.equal(result.item.resolved_event_id, undefined);
  }
  assert.ok(statements.every(({ sql }) => !/INSERT|UPDATE|DELETE/.test(sql)), "Existing records stay unchanged");
  for (const status of ["curator_approved", "auto_extracted", "duplicate", "expired"]) {
    item = { ...fixture, status, event_id: 99, resolved_event_id: 44 };
    assert.deepEqual(await findCuratorAddTarget(url), { reused: true, discoveryItemId: 7, destination: "event", eventId: 44 });
  }
  const lookup = statements[0];
  assert.match(lookup.sql, /event_aliases/);
  assert.match(lookup.sql, /COALESCE\(a.canonical_id, di.event_id\)/);
  assert.doesNotMatch(lookup.sql, /LIMIT|ev.status/);
  assert.deepEqual(lookup.values, [url]);
  item = { ...fixture, status: "curator_approved", event_id: 99 };
  await assert.rejects(findCuratorAddTarget(url), /no accessible review or event/);
  for (created of [true, false]) {
    item = null;
    const result = await (await POST(request({ url }))).json();
    assert.equal(result.reused, !created);
    assert.equal(result.destination, "queue");
    assert.equal(result.item.id, 7);
  }
  assert.match(statements.find(({ sql }) => sql.includes("INSERT"))!.sql, /ON CONFLICT \(url\) DO NOTHING/);
  assert.equal((await GET(new NextRequest("http://localhost/api/admin/events?id=44"))).status, 401);
  for (const id of ["0", "-1", "bad", "1.5"]) assert.equal((await GET(new NextRequest(`http://localhost/api/admin/events?id=${id}`, { headers }))).status, 400);
  assert.equal((await GET(new NextRequest("http://localhost/api/admin/events?id=44", { headers }))).status, 200);
  assert.deepEqual(statements.at(-1)!.values, ["", 44]);
  assert.match(statements.at(-1)!.sql, /\$2::integer IS NULL AND e.status <> 'expired' OR e.id = \$2::integer/);
  await GET(new NextRequest("http://localhost/api/admin/events", { headers }));
  assert.deepEqual(statements.at(-1)!.values, ["", null]);

  // Retain the existing curator layout/classes while changing data routing.
  const path = "components/curator/CuratorApp.tsx";
  const before = execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf8" });
  const after = readFileSync(path, "utf8");
  const classes = (s: string) => s.match(/className=(?:"[^"]*"|\{`[^`]*`\})/g);
  assert.deepEqual(classes(after), classes(before));
  assert.match(after, /fetchPublishedEvents\("", res.eventId\)/);
  assert.match(after, /setQueue\(res.queue\)/);
  assert.match(after, /setAddedCandidate\(\{ queue: res.queue, item: res.item \}\)/);
  assert.match(after, /key=\{editEvent.id\}/);
  console.log("PASS curator Add URL: all queues, expired published events, canonical aliases, exact target outside list limits, drafts, no republish, auth, concurrent adds, and unchanged design classes");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
