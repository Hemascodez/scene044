/** Compare the live Supabase public schema with the Neon production copy.
 * Read-only: never prints connection strings or row contents.
 * Run with: node --env-file=.env.local --import tsx scripts/verify-neon-migration.ts
 */
import { spawnSync } from "node:child_process";
import { Client } from "pg";

const PROJECT_ID = "weathered-wildflower-11840237";
const BRANCH = "production";

function neonConnectionString(): string {
  const result = spawnSync(
    "neon",
    ["connection-string", BRANCH, "--project-id", PROJECT_ID],
    { encoding: "utf8", timeout: 30_000 },
  );
  if (result.status !== 0) {
    const detail = result.error?.message ?? result.stderr.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted URL]").trim();
    throw new Error(`Could not resolve the Neon connection string: ${detail || `exit ${result.status}`}`);
  }
  const url = result.stdout.split("\n").find((line) => line.startsWith("postgres"));
  if (!url) throw new Error("Neon did not return a connection string");
  const connection = new URL(url.trim());
  connection.searchParams.set("sslmode", "verify-full");
  return connection.toString();
}

async function tableNames(client: Client): Promise<string[]> {
  const { rows } = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  return rows.map((row) => row.tablename);
}

async function tableDigest(client: Client, table: string) {
  const name = table.replaceAll('"', '""');
  const { rows } = await client.query<{ count: string; digest: string }>(
    `SELECT count(*)::text AS count,
            md5(coalesce(string_agg(row_hash, '' ORDER BY row_hash), '')) AS digest
       FROM (SELECT md5(to_jsonb(t)::text) AS row_hash FROM public."${name}" AS t) hashed`,
  );
  return rows[0];
}

async function sequenceValues(client: Client) {
  const { rows } = await client.query<{ sequencename: string; last_value: string | null }>(
    "SELECT sequencename, last_value::text FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename",
  );
  return rows;
}

async function main() {
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error("DATABASE_URL is missing");
  const sourceUrl = new URL(configured);
  if (!sourceUrl.hostname.endsWith(".pooler.supabase.com")) {
    throw new Error("DATABASE_URL is not the expected Supabase pooler URL");
  }
  sourceUrl.port = "5432"; // session pooler for consistent read-only checks

  // Match the application's existing Supabase TLS settings. The pooler's
  // certificate chain is not trusted by this local Node installation.
  const source = new Client({ connectionString: sourceUrl.toString(), ssl: { rejectUnauthorized: false } });
  const target = new Client({ connectionString: neonConnectionString() });

  try {
    await source.connect().catch(() => { throw new Error("Supabase TLS connection failed"); });
    await target.connect().catch(() => { throw new Error("Neon TLS connection failed"); });
    await Promise.all([source.query("SET TIME ZONE 'UTC'"), target.query("SET TIME ZONE 'UTC'")]);
    const [sourceNames, targetNames] = await Promise.all([tableNames(source), tableNames(target)]);
    const mismatches: string[] = [];
    for (const table of new Set([...sourceNames, ...targetNames])) {
      if (!sourceNames.includes(table) || !targetNames.includes(table)) {
        mismatches.push(`${table}: table missing on one side`);
        continue;
      }
      const [a, b] = await Promise.all([tableDigest(source, table), tableDigest(target, table)]);
      if (a.count !== b.count || a.digest !== b.digest) {
        mismatches.push(`${table}: rows ${a.count} / ${b.count}; digest ${a.digest === b.digest ? "match" : "differs"}`);
      }
    }
    const [sourceSequences, targetSequences] = await Promise.all([
      sequenceValues(source), sequenceValues(target),
    ]);
    if (JSON.stringify(sourceSequences) !== JSON.stringify(targetSequences)) {
      const targetByName = new Map(targetSequences.map((row) => [row.sequencename, row.last_value]));
      for (const row of sourceSequences) {
        if (row.last_value !== targetByName.get(row.sequencename)) {
          mismatches.push(`${row.sequencename}: sequence position differs`);
        }
      }
      for (const row of targetSequences) {
        if (!sourceSequences.some((sourceRow) => sourceRow.sequencename === row.sequencename)) {
          mismatches.push(`${row.sequencename}: sequence missing in Supabase`);
        }
      }
    }
    console.log(`Compared ${sourceNames.length} Supabase and ${targetNames.length} Neon public tables.`);
    if (mismatches.length) {
      for (const mismatch of mismatches) console.log(mismatch);
      process.exitCode = 2;
    } else {
      console.log("All public table row counts and content digests match.");
    }
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
