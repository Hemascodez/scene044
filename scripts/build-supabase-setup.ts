/**
 * Emits one SQL file that stands up a fresh Supabase database.
 *
 * Exists because database ports (5432/6543) are blocked on this network — HTTPS
 * reaches the project fine, but the Postgres protocol is reset before the
 * handshake completes, so the usual `npm run migrate` cannot run from here.
 * Supabase's browser SQL editor goes over HTTPS, so pasting this works.
 *
 * Schema comes from db/schema.sql verbatim; the seed rows are read from the
 * local database so what lands in Supabase is exactly what has been running.
 */
import fs from "node:fs";
import path from "node:path";
import { pool, query } from "../lib/db";

const q = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");

  const { rows: sources } = await query<{
    domain: string; name: string; trust_tier: string;
    robots_allowed: boolean | null; rate_limit_per_hour: number | null; active: boolean | null;
  }>("SELECT domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active FROM sources ORDER BY id");

  const { rows: queries } = await query<{
    query_text: string; category_hint: string | null; site_filter: string | null; active: boolean | null;
  }>("SELECT query_text, category_hint, site_filter, active FROM search_queries ORDER BY id");

  const out: string[] = [
    "-- SCENE/044 — full Supabase setup.",
    "-- Paste into the Supabase SQL Editor (Database > SQL Editor > New query) and Run.",
    "-- Safe to re-run: every statement is idempotent.",
    "",
    "-- ============================ SCHEMA ============================",
    schema.trim(),
    "",
    "-- ============================ SOURCES ===========================",
    ...sources.map(
      (s) =>
        `INSERT INTO sources (domain, name, trust_tier, robots_allowed, rate_limit_per_hour, active) VALUES (${q(s.domain)}, ${q(s.name)}, ${q(s.trust_tier)}, ${s.robots_allowed ?? "NULL"}, ${s.rate_limit_per_hour ?? "NULL"}, ${s.active ?? "NULL"}) ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, trust_tier = EXCLUDED.trust_tier, robots_allowed = EXCLUDED.robots_allowed, rate_limit_per_hour = EXCLUDED.rate_limit_per_hour, active = EXCLUDED.active;`,
    ),
    "",
    "-- ========================= SEARCH QUERIES =======================",
    ...queries.map(
      (r) =>
        `INSERT INTO search_queries (query_text, category_hint, site_filter, active) VALUES (${q(r.query_text)}, ${q(r.category_hint)}, ${q(r.site_filter)}, ${r.active ?? "NULL"}) ON CONFLICT (query_text, COALESCE(site_filter, '')) DO UPDATE SET category_hint = EXCLUDED.category_hint, active = EXCLUDED.active;`,
    ),
    "",
    `-- ${sources.length} sources, ${queries.length} search queries.`,
    "-- Events are NOT copied: the pipeline rediscovers them on its first run,",
    "-- and stale event rows would ship a feed that was already out of date.",
    "",
  ];

  const target = path.join(__dirname, "..", "db", "supabase-setup.sql");
  fs.writeFileSync(target, out.join("\n"));
  console.log(`wrote db/supabase-setup.sql — ${sources.length} sources, ${queries.length} queries, ${out.join("\n").length} bytes`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
